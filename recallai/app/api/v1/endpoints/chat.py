import uuid
import logging
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.memory import Memory
from app.models.entity import Entity
from app.schemas.chat import ChatRequest, ChatResponse, SourceMemory
from app.services.retrieval.query_parser import get_query_parser
from app.services.retrieval.hybrid_search import hybrid_search
from app.services.retrieval.fusion_ranker import reciprocal_rank_fusion
from app.services.retrieval.answer_generator import get_answer_generator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

_conversations: dict[str, list[dict]] = defaultdict(list)


async def _load_memories(db: AsyncSession, memory_ids: list[str]) -> list[dict]:
    """Load full memory objects for answer generation."""
    if not memory_ids:
        return []

    result = await db.execute(
        select(Memory).where(Memory.id.in_(memory_ids))
    )
    memories = result.scalars().all()

    loaded = []
    for mem in memories:
        entities_result = await db.execute(
            select(Entity).where(Entity.memory_id == mem.id)
        )
        entities = [
            {"type": e.type, "value": e.value}
            for e in entities_result.scalars().all()
        ]

        session = None
        if mem.session_id:
            from app.models.capture_session import CaptureSession
            session = await db.get(CaptureSession, mem.session_id)

        loaded.append({
            "id": mem.id,
            "created_at": mem.created_at.isoformat() if mem.created_at else "",
            "summary": mem.summary,
            "transcript": mem.transcript,
            "image_refs": mem.image_refs,
            "entities": entities,
            "place_name": session.place_name if session else None,
            "confidence": mem.confidence,
            "duration_sec": mem.duration_sec,
        })

    return loaded


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    conversation_id = request.conversation_id or str(uuid.uuid4())
    conversation_history = _conversations.get(conversation_id, [])

    parser = get_query_parser()
    parsed = parser.parse(request.message)
    logger.info("Parsed query: %s", parsed)

    time_start, time_end = parser.resolve_time_range(parsed)

    search_results = await hybrid_search(
        db=db,
        query_text=request.message,
        entities=parsed.get("entities", []),
        time_start=time_start,
        time_end=time_end,
    )

    ranked = reciprocal_rank_fusion(search_results)
    top_results = ranked[:5]

    top_confidence = "low"
    if top_results:
        top_confidence = top_results[0].get("confidence", "low")

    memory_ids = [r["memory_id"] for r in top_results]
    memories = await _load_memories(db, memory_ids)

    generator = get_answer_generator()
    response = generator.generate(
        query=request.message,
        memories=memories,
        confidence=top_confidence,
        conversation_history=conversation_history if conversation_history else None,
    )

    _conversations[conversation_id].append(
        {"role": "user", "content": request.message}
    )
    _conversations[conversation_id].append(
        {"role": "assistant", "content": response["answer"]}
    )

    sources = []
    for mem in memories:
        sources.append(SourceMemory(
            id=mem["id"],
            created_at=mem.get("created_at"),
            place_name=mem.get("place_name"),
            summary=mem.get("summary"),
            confidence=top_confidence,
        ))

    return ChatResponse(
        answer=response["answer"],
        confidence=response["confidence"],
        sources=sources,
        follow_ups=response.get("follow_ups", []),
        conversation_id=conversation_id,
    )
