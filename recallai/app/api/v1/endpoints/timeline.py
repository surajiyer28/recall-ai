from datetime import datetime, time, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.memory import Memory
from app.models.entity import Entity
from app.models.capture_session import CaptureSession
from app.schemas.timeline import TimelineEntry, TimelineResponse, MemoryStatsResponse

router = APIRouter(prefix="/timeline", tags=["timeline"])


def _classify_memory_type(memory: Memory) -> str:
    if memory.image_refs:
        return "image"
    if memory.duration_sec and memory.duration_sec > 300:
        return "meeting"
    if memory.duration_sec and memory.duration_sec > 0:
        return "conversation"
    if memory.transcript and len(memory.transcript) < 200:
        return "thought"
    return "capture"


@router.get("", response_model=TimelineResponse)
async def get_timeline(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    entity_type: Optional[str] = Query(None),
    memory_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.now(timezone.utc).date()
    else:
        target_date = datetime.now(timezone.utc).date()

    day_start = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(target_date, time.max).replace(tzinfo=timezone.utc)

    query = (
        select(Memory)
        .where(Memory.created_at >= day_start, Memory.created_at <= day_end)
        .order_by(Memory.created_at.desc())
    )

    if entity_type:
        query = query.join(Entity).where(Entity.type == entity_type)

    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    memories = result.scalars().all()

    entries = []
    for mem in memories:
        entities_result = await db.execute(
            select(Entity).where(Entity.memory_id == mem.id)
        )
        entities = entities_result.scalars().all()
        entity_tags = list(set(e.value for e in entities))[:6]
        action_items = sum(1 for e in entities if e.type == "action_item")

        mtype = _classify_memory_type(mem)
        if memory_type and mtype != memory_type:
            continue

        session = await db.get(CaptureSession, mem.session_id) if mem.session_id else None

        entries.append(TimelineEntry(
            id=mem.id,
            created_at=mem.created_at,
            summary=mem.summary,
            place_name=session.place_name if session else None,
            duration_sec=mem.duration_sec,
            capture_trigger=mem.capture_trigger,
            entity_tags=entity_tags,
            memory_type=mtype,
            action_item_count=action_items,
            has_images=bool(mem.image_refs),
        ))

    return TimelineResponse(
        date=target_date.isoformat(),
        entries=entries,
        total=total,
    )


@router.get("/stats", response_model=MemoryStatsResponse)
async def get_memory_stats(db: AsyncSession = Depends(get_db)):
    total_result = await db.execute(select(func.count(Memory.id)))
    total_count = total_result.scalar_one()

    today_start = datetime.combine(
        datetime.now(timezone.utc).date(), time.min
    ).replace(tzinfo=timezone.utc)
    today_result = await db.execute(
        select(func.count(Memory.id)).where(Memory.created_at >= today_start)
    )
    today_count = today_result.scalar_one()

    all_memories = await db.execute(select(Memory))
    by_type: dict[str, int] = {}
    for mem in all_memories.scalars().all():
        mtype = _classify_memory_type(mem)
        by_type[mtype] = by_type.get(mtype, 0) + 1

    entity_counts = await db.execute(
        select(Entity.type, func.count(Entity.id)).group_by(Entity.type)
    )
    by_entity_type = {row[0]: row[1] for row in entity_counts.all()}

    return MemoryStatsResponse(
        today_count=today_count,
        total_count=total_count,
        by_type=by_type,
        by_entity_type=by_entity_type,
    )
