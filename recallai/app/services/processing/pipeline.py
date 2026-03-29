import logging
import tempfile
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import Memory
from app.models.processing_queue import ProcessingQueueJob
from app.models.capture_session import CaptureSession
from app.services.privacy.pii_redactor import redact_pii
from app.services.processing.whisper_service import get_whisper_service
from app.services.processing.embedding_service import get_embedding_service
from app.services.processing.ner_service import (
    extract_entities,
    store_entities,
    build_entity_relationships,
)
from app.services.processing.summarization_service import get_summarization_service
from app.services.processing.metadata_enrichment import enrich_metadata
from app.services.processing.frame_extractor import (
    extract_frames,
    split_video_chunks,
    cleanup_extracted_files,
)
from app.services.processing.ocr_service import extract_text_from_images
from app.services.processing.vision_service import get_vision_service
from app.services.processing.person_extractor import extract_and_store_people
from app.services.storage.vector_store import add_memory_vectors
from app.utils.file_handling import delete_file

logger = logging.getLogger(__name__)


async def _run_ner_and_summarize(
    db: AsyncSession, session_id: str, text: str, ocr_texts: dict | None = None
) -> dict:
    """
    Shared step: run NER on text + OCR, store entities, build graph edges,
    then generate Claude summary. Returns {entities, summary}.
    """
    result = {"entities": [], "summary": ""}

    all_text = text or ""
    if ocr_texts:
        all_text += "\n" + "\n".join(ocr_texts.values())

    ner_job = await _find_job(db, session_id, "ner")
    if ner_job:
        await _update_job_status(db, ner_job, "in_flight")
    try:
        raw_entities = extract_entities(all_text)
        memory = await _get_memory_for_session(db, session_id)
        if memory and raw_entities:
            stored = await store_entities(db, memory.id, raw_entities)
            await build_entity_relationships(db, memory.id, stored)
            result["entities"] = raw_entities
        if ner_job:
            await _update_job_status(db, ner_job, "done")
    except Exception as e:
        logger.error("NER failed for session %s: %s", session_id, e)
        if ner_job:
            await _update_job_status(db, ner_job, "failed")

    summarise_job = await _find_job(db, session_id, "summarise")
    if summarise_job:
        await _update_job_status(db, summarise_job, "in_flight")
    try:
        if all_text.strip():
            session = await db.get(CaptureSession, session_id)
            svc = get_summarization_service()
            summary = svc.summarize(
                transcript=all_text,
                entities=result["entities"],
                place_name=session.place_name if session else None,
                duration_sec=None,
            )
            result["summary"] = summary

            memory = await _get_memory_for_session(db, session_id)
            if memory:
                memory.summary = summary
                await db.commit()

        if summarise_job:
            await _update_job_status(db, summarise_job, "done")
    except Exception as e:
        logger.error("Summarization failed for session %s: %s", session_id, e)
        if summarise_job:
            await _update_job_status(db, summarise_job, "failed")

    session = await db.get(CaptureSession, session_id)
    if session and session.gps_lat and session.gps_lng and not session.place_name:
        enriched = enrich_metadata(session.gps_lat, session.gps_lng, session.place_name)
        if enriched.get("place_name"):
            session.place_name = enriched["place_name"]
            await db.commit()

    return result


async def _get_memory_for_session(db: AsyncSession, session_id: str) -> Memory | None:
    result = await db.execute(
        select(Memory).where(Memory.session_id == session_id).limit(1)
    )
    return result.scalar_one_or_none()


async def _update_job_status(
    db: AsyncSession, job: ProcessingQueueJob, status: str
) -> None:
    job.status = status
    job.last_attempted = datetime.now(timezone.utc)
    if status == "failed":
        job.retry_count += 1
    await db.commit()


async def process_audio(db: AsyncSession, session_id: str, audio_path: str) -> dict:
    """
    Full audio pipeline: Whisper STT -> embed transcript -> store vectors.
    Returns processing results dict.
    """
    result = {"transcript": "", "duration_sec": 0, "segments": [], "vectors_stored": 0}

    whisper_job = await _find_job(db, session_id, "whisper")
    if whisper_job:
        await _update_job_status(db, whisper_job, "in_flight")

    try:
        whisper = get_whisper_service()
        stt_result = await whisper.transcribe(audio_path)
        transcript = redact_pii(stt_result["transcript"])
        result["transcript"] = transcript
        result["duration_sec"] = stt_result["duration_sec"]
        result["segments"] = stt_result["segments"]

        memory = await _get_memory_for_session(db, session_id)
        if memory:
            memory.transcript = transcript
            memory.duration_sec = stt_result["duration_sec"]
            await db.commit()

        if whisper_job:
            await _update_job_status(db, whisper_job, "done")

        delete_file(audio_path)

    except Exception as e:
        logger.error("Audio STT failed for session %s: %s", session_id, e)
        if whisper_job:
            await _update_job_status(db, whisper_job, "failed")
        raise

    embed_job = await _find_job(db, session_id, "embedding")
    if embed_job:
        await _update_job_status(db, embed_job, "in_flight")
    try:
        if result["transcript"]:
            embedding_svc = get_embedding_service()
            text_emb = embedding_svc.embed_text(result["transcript"])

            memory = await _get_memory_for_session(db, session_id)
            if memory:
                count = add_memory_vectors(
                    memory_id=memory.id,
                    session_id=session_id,
                    timestamp=memory.created_at,
                    text_embedding=text_emb,
                )
                result["vectors_stored"] = count

        if embed_job:
            await _update_job_status(db, embed_job, "done")
    except Exception as e:
        logger.error("Embedding failed for session %s: %s", session_id, e)
        if embed_job:
            await _update_job_status(db, embed_job, "failed")

    ner_result = await _run_ner_and_summarize(db, session_id, result["transcript"])
    result.update(ner_result)

    # Extract people, highlights, and tasks from transcript
    memory = await _get_memory_for_session(db, session_id)
    if memory and result["transcript"]:
        try:
            await extract_and_store_people(db, memory.id, result["transcript"])
        except Exception as e:
            logger.error("Person extraction failed for session %s: %s", session_id, e)

    return result


async def process_video(db: AsyncSession, session_id: str, video_path: str) -> dict:
    """
    Full video pipeline: Gemini Flash captions video chunks (vision + audio),
    OCR on extracted frames as safety net, embed all text.
    No Whisper or audio extraction needed — Gemini handles speech in video.
    """
    result = {
        "transcript": "", "duration_sec": 0, "frame_count": 0,
        "ocr_texts": {}, "vectors_stored": 0,
    }

    frame_job = await _find_job(db, session_id, "frame_extract")
    if frame_job:
        await _update_job_status(db, frame_job, "in_flight")

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            frame_paths = []
            video_chunks = []

            # Split video into <=60s chunks for Gemini captioning
            try:
                video_chunks = split_video_chunks(video_path, tmpdir)
            except Exception as e:
                logger.error("Video chunking failed for %s: %s", session_id, e)
                video_chunks = [video_path]

            # Extract frames for OCR safety net
            try:
                frame_paths = extract_frames(video_path, tmpdir)
                result["frame_count"] = len(frame_paths)
            except Exception as e:
                logger.error("Frame extraction failed for video %s: %s", session_id, e)

            if frame_job:
                status = "done" if video_chunks else "failed"
                await _update_job_status(db, frame_job, status)

            # Caption each video chunk with Gemini Flash (handles vision + audio)
            captions = []
            try:
                vision_svc = get_vision_service()
                for chunk_path in video_chunks:
                    caption = vision_svc.caption_video(chunk_path)
                    if caption:
                        captions.append(caption)
            except Exception as e:
                logger.error("Video captioning failed for %s: %s", session_id, e)

            result["transcript"] = "\n\n".join(captions)

            memory = await _get_memory_for_session(db, session_id)
            if memory and result["transcript"]:
                memory.transcript = result["transcript"]
                await db.commit()

            # OCR on extracted frames as safety net
            if frame_paths:
                ocr_texts = extract_text_from_images(frame_paths)
                result["ocr_texts"] = ocr_texts

            # Embed: caption text + OCR text
            embed_job = await _find_job(db, session_id, "embedding")
            if embed_job:
                await _update_job_status(db, embed_job, "in_flight")
            try:
                embedding_svc = get_embedding_service()
                text_emb = None
                ocr_embs = None

                # Combine caption + OCR for the main text embedding
                all_text = result["transcript"]
                ocr_values = list(result["ocr_texts"].values())
                if ocr_values:
                    all_text += "\n" + "\n".join(ocr_values)
                    ocr_embs = embedding_svc.embed_texts_batch(ocr_values)

                if all_text.strip():
                    text_emb = embedding_svc.embed_text(all_text)

                # Cleanup temp files
                chunks_to_clean = [c for c in video_chunks if c != video_path]
                cleanup_extracted_files(chunks_to_clean + frame_paths)

                memory = await _get_memory_for_session(db, session_id)
                if memory:
                    count = add_memory_vectors(
                        memory_id=memory.id,
                        session_id=session_id,
                        timestamp=memory.created_at,
                        text_embedding=text_emb,
                        ocr_embeddings=ocr_embs,
                    )
                    result["vectors_stored"] = count

                if embed_job:
                    await _update_job_status(db, embed_job, "done")
            except Exception as e:
                logger.error("Embedding failed for video %s: %s", session_id, e)
                if embed_job:
                    await _update_job_status(db, embed_job, "failed")

            delete_file(video_path)

    except Exception as e:
        logger.error("Video processing failed for session %s: %s", session_id, e)
        if frame_job:
            await _update_job_status(db, frame_job, "failed")
        raise

    ner_result = await _run_ner_and_summarize(
        db, session_id, result["transcript"], result.get("ocr_texts")
    )
    result.update(ner_result)

    # Extract people, highlights, and tasks from video caption
    memory = await _get_memory_for_session(db, session_id)
    if memory and result["transcript"]:
        try:
            await extract_and_store_people(db, memory.id, result["transcript"])
        except Exception as e:
            logger.error("Person extraction failed for session %s: %s", session_id, e)

    return result


async def process_images(
    db: AsyncSession, session_id: str, image_paths: list[str]
) -> dict:
    """
    Image pipeline: Gemini Flash captions each image + OCR as safety net,
    embed all text. Standalone images are retained (not deleted) per privacy spec.
    """
    result = {"ocr_texts": {}, "captions": {}, "image_paths": image_paths, "vectors_stored": 0}

    # Caption images with Gemini Flash
    try:
        vision_svc = get_vision_service()
        for img_path in image_paths:
            caption = vision_svc.caption_image(img_path)
            if caption:
                result["captions"][img_path] = caption
    except Exception as e:
        logger.error("Image captioning failed for session %s: %s", session_id, e)

    # OCR as safety net
    ocr_job = await _find_job(db, session_id, "ocr")
    if ocr_job:
        await _update_job_status(db, ocr_job, "in_flight")
    try:
        ocr_texts = extract_text_from_images(image_paths)
        result["ocr_texts"] = ocr_texts
        if ocr_job:
            await _update_job_status(db, ocr_job, "done")
    except Exception as e:
        logger.error("Image OCR failed for session %s: %s", session_id, e)
        if ocr_job:
            await _update_job_status(db, ocr_job, "failed")

    # Combine captions + OCR into a single text, then embed
    caption_text = "\n".join(result["captions"].values())
    ocr_text = "\n".join(result["ocr_texts"].values())
    all_text = "\n".join(t for t in [caption_text, ocr_text] if t)

    # Store caption as transcript on the memory
    memory = await _get_memory_for_session(db, session_id)
    if memory and caption_text:
        memory.transcript = caption_text
        await db.commit()

    embed_job = await _find_job(db, session_id, "embedding")
    if embed_job:
        await _update_job_status(db, embed_job, "in_flight")
    try:
        embedding_svc = get_embedding_service()
        text_emb = None
        ocr_embs = None

        if all_text.strip():
            text_emb = embedding_svc.embed_text(all_text)

        ocr_values = list(result["ocr_texts"].values())
        if ocr_values:
            ocr_embs = embedding_svc.embed_texts_batch(ocr_values)

        memory = await _get_memory_for_session(db, session_id)
        if memory:
            count = add_memory_vectors(
                memory_id=memory.id,
                session_id=session_id,
                timestamp=memory.created_at,
                text_embedding=text_emb,
                ocr_embeddings=ocr_embs,
            )
            result["vectors_stored"] = count

        if embed_job:
            await _update_job_status(db, embed_job, "done")
    except Exception as e:
        logger.error("Embedding failed for images %s: %s", session_id, e)
        if embed_job:
            await _update_job_status(db, embed_job, "failed")

    # NER + summarize on combined text (always runs, not just when OCR has text)
    if all_text.strip():
        ner_result = await _run_ner_and_summarize(db, session_id, all_text)
        result.update(ner_result)

    # Extract people, highlights, and tasks from image captions + OCR
    memory = await _get_memory_for_session(db, session_id)
    if memory and all_text.strip():
        try:
            await extract_and_store_people(db, memory.id, all_text)
        except Exception as e:
            logger.error("Person extraction failed for session %s: %s", session_id, e)

    return result


async def run_pipeline(
    db: AsyncSession, session_id: str, media_type: str, payload_path: str
) -> dict:
    """
    Main pipeline orchestrator. Dispatches to the correct sub-pipeline
    based on media type. Called by the background task worker.
    """
    logger.info("Starting pipeline for session %s (type: %s)", session_id, media_type)

    try:
        if media_type == "audio":
            result = await process_audio(db, session_id, payload_path)
        elif media_type == "video":
            result = await process_video(db, session_id, payload_path)
        elif media_type == "image":
            memory = await _get_memory_for_session(db, session_id)
            image_paths = []
            if memory and memory.image_refs and "paths" in memory.image_refs:
                image_paths = memory.image_refs["paths"]
            result = await process_images(db, session_id, image_paths)
        else:
            raise ValueError(f"Unknown media type: {media_type}")
    except Exception as e:
        logger.error("Pipeline failed for session %s: %s", session_id, e)
        result = {}
        # Mark session as failed so it doesn't stay stuck in "processing"
        session = await db.get(CaptureSession, session_id)
        if session and session.status == "processing":
            session.status = "failed"
            session.ended_at = datetime.now(timezone.utc)
            await db.commit()
        return result

    session = await db.get(CaptureSession, session_id)
    if session and session.status == "processing":
        session.status = "stored"
        session.ended_at = datetime.now(timezone.utc)
        await db.commit()

    logger.info("Pipeline complete for session %s", session_id)
    return result


async def _find_job(
    db: AsyncSession, session_id: str, job_type: str
) -> ProcessingQueueJob | None:
    result = await db.execute(
        select(ProcessingQueueJob).where(
            ProcessingQueueJob.session_id == session_id,
            ProcessingQueueJob.job_type == job_type,
        ).limit(1)
    )
    return result.scalar_one_or_none()
