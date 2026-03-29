from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.capture import (
    CaptureSessionList,
    CaptureSessionOut,
    CaptureStatusOut,
    ProcessingQueueJobOut,
    RecordStartResponse,
    UploadResponse,
)
from app.services import capture_service
from app.services.capture_service import get_capture_state
from app.utils.file_handling import save_upload, save_image_upload
from app.workers.task_queue import run_pipeline_background


def _assert_capture_allowed():
    """Raise 409 if capture is paused / in a privacy zone / quiet hours / offline."""
    state = get_capture_state()
    if not state.is_capture_allowed():
        raise HTTPException(
            status_code=409,
            detail=f"Capture is currently '{state.status}'. Resume capture before uploading.",
        )

router = APIRouter(prefix="/capture", tags=["capture"])


@router.post("/upload/audio", response_model=UploadResponse)
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    place_name: Optional[str] = Form(None),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None),
    source_device: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    _assert_capture_allowed()

    session = await capture_service.create_session(
        db,
        trigger="manual_upload",
        status="processing",
        place_name=place_name,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
    )

    try:
        filepath = await save_upload(file, "audio", session.id)
    except ValueError as e:
        raise HTTPException(status_code=415, detail=str(e))

    memory = await capture_service.create_memory_for_session(
        db, session.id, capture_trigger="manual_upload"
    )

    job_types = ["whisper", "embedding", "ner", "summarise"]
    jobs = await capture_service.enqueue_jobs(
        db, session.id, job_types, payload_path=filepath
    )

    background_tasks.add_task(run_pipeline_background, session.id, "audio", filepath)

    return UploadResponse(
        session_id=session.id,
        status="processing",
        message="Audio uploaded. Processing pipeline started.",
        jobs_queued=[j.job_type for j in jobs],
    )


@router.post("/upload/video", response_model=UploadResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    place_name: Optional[str] = Form(None),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None),
    source_device: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    _assert_capture_allowed()

    session = await capture_service.create_session(
        db,
        trigger="manual_upload",
        status="processing",
        place_name=place_name,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
    )

    try:
        filepath = await save_upload(file, "video", session.id)
    except ValueError as e:
        raise HTTPException(status_code=415, detail=str(e))

    memory = await capture_service.create_memory_for_session(
        db, session.id, capture_trigger="manual_upload"
    )

    job_types = ["frame_extract", "whisper", "embedding", "ner", "summarise"]
    jobs = await capture_service.enqueue_jobs(
        db, session.id, job_types, payload_path=filepath
    )

    background_tasks.add_task(run_pipeline_background, session.id, "video", filepath)

    return UploadResponse(
        session_id=session.id,
        status="processing",
        message="Video uploaded. Processing pipeline started.",
        jobs_queued=[j.job_type for j in jobs],
    )


@router.post("/upload/image", response_model=UploadResponse)
async def upload_images(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    place_name: Optional[str] = Form(None),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None),
    source_device: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    _assert_capture_allowed()

    session = await capture_service.create_session(
        db,
        trigger="manual_upload",
        status="processing",
        place_name=place_name,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
    )

    saved_paths = []
    for i, f in enumerate(files):
        try:
            path = await save_image_upload(f, session.id, i)
            saved_paths.append(path)
        except ValueError as e:
            raise HTTPException(status_code=415, detail=str(e))

    memory = await capture_service.create_memory_for_session(
        db,
        session.id,
        capture_trigger="manual_upload",
        image_refs={"paths": saved_paths},
    )

    job_types = ["ocr", "embedding", "ner"]
    jobs = await capture_service.enqueue_jobs(
        db, session.id, job_types, payload_path=saved_paths[0] if saved_paths else None
    )

    background_tasks.add_task(run_pipeline_background, session.id, "image", saved_paths[0] if saved_paths else "")

    return UploadResponse(
        session_id=session.id,
        status="processing",
        message=f"{len(saved_paths)} image(s) uploaded. Processing pipeline started.",
        jobs_queued=[j.job_type for j in jobs],
    )


@router.post("/record/start", response_model=RecordStartResponse)
async def start_recording(
    place_name: Optional[str] = None,
    gps_lat: Optional[float] = None,
    gps_lng: Optional[float] = None,
    source_device: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    _assert_capture_allowed()

    state = get_capture_state()
    if state.active_session_id is not None:
        raise HTTPException(
            status_code=409,
            detail=f"A recording session is already active: {state.active_session_id}",
        )

    session = await capture_service.create_session(
        db,
        trigger="vad",
        status="recording",
        place_name=place_name,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
    )
    state.active_session_id = session.id
    return RecordStartResponse(session_id=session.id, status="recording")


@router.post("/record/stop/{session_id}", response_model=UploadResponse)
async def stop_recording(
    session_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    session = await capture_service.get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "recording":
        raise HTTPException(
            status_code=400, detail=f"Session is '{session.status}', not 'recording'"
        )

    try:
        filepath = await save_upload(file, "audio", session.id)
    except ValueError as e:
        raise HTTPException(status_code=415, detail=str(e))

    await capture_service.transition_session(db, session_id, "processing")

    state = get_capture_state()
    if state.active_session_id == session_id:
        state.active_session_id = None

    memory = await capture_service.create_memory_for_session(
        db, session.id, capture_trigger="vad"
    )

    job_types = ["whisper", "embedding", "ner", "summarise"]
    jobs = await capture_service.enqueue_jobs(
        db, session.id, job_types, payload_path=filepath
    )

    background_tasks.add_task(run_pipeline_background, session.id, "audio", filepath)

    return UploadResponse(
        session_id=session.id,
        status="processing",
        message="Recording stopped. Processing pipeline started.",
        jobs_queued=[j.job_type for j in jobs],
    )


@router.get("/sessions", response_model=CaptureSessionList)
async def list_sessions(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    sessions, total = await capture_service.list_sessions(db, limit, offset)
    return CaptureSessionList(
        sessions=[CaptureSessionOut.model_validate(s) for s in sessions],
        total=total,
    )


@router.get("/sessions/{session_id}", response_model=CaptureSessionOut)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await capture_service.get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return CaptureSessionOut.model_validate(session)


@router.get("/sessions/{session_id}/jobs", response_model=list[ProcessingQueueJobOut])
async def get_session_jobs(session_id: str, db: AsyncSession = Depends(get_db)):
    jobs = await capture_service.get_queue_jobs(db, session_id=session_id)
    return [ProcessingQueueJobOut.model_validate(j) for j in jobs]


@router.get("/status", response_model=CaptureStatusOut)
async def capture_status():
    state = get_capture_state()
    return CaptureStatusOut(
        capture_status=state.status,
        active_session_id=state.active_session_id,
    )


@router.post("/pause", response_model=CaptureStatusOut)
async def pause_capture():
    state = get_capture_state()
    if state.status != "active":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot pause: capture is currently '{state.status}'",
        )
    state.status = "paused"
    return CaptureStatusOut(
        capture_status=state.status,
        active_session_id=state.active_session_id,
    )


@router.post("/resume", response_model=CaptureStatusOut)
async def resume_capture():
    state = get_capture_state()
    if state.status not in ("paused", "privacy_zone", "quiet_hours", "offline"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot resume: capture is currently '{state.status}'",
        )
    state.status = "active"
    return CaptureStatusOut(
        capture_status=state.status,
        active_session_id=state.active_session_id,
    )
