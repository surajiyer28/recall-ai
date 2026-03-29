import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity
from app.models.memory import Memory
from app.models.capture_session import CaptureSession

logger = logging.getLogger(__name__)


async def check_upcoming_commitments(
    db: AsyncSession, hours_ahead: int = 24
) -> list[dict]:
    """Check for action items / deadlines in the next N hours."""
    action_items = await db.execute(
        select(Entity, Memory)
        .join(Memory, Entity.memory_id == Memory.id)
        .where(Entity.type == "action_item")
    )

    findings = []
    for entity, memory in action_items.all():
        findings.append({
            "type": "upcoming_commitment",
            "entity_value": entity.value,
            "memory_id": memory.id,
            "memory_summary": memory.summary,
            "created_at": memory.created_at.isoformat() if memory.created_at else "",
        })
    return findings


async def check_location_memories(
    db: AsyncSession, lat: float, lng: float, radius_km: float = 0.5
) -> list[dict]:
    """Check if the user is near a location where memories were captured."""
    lat_range = radius_km / 111.0
    lng_range = radius_km / (111.0 * 0.85)

    result = await db.execute(
        select(CaptureSession)
        .where(
            CaptureSession.gps_lat.isnot(None),
            CaptureSession.gps_lat.between(lat - lat_range, lat + lat_range),
            CaptureSession.gps_lng.between(lng - lng_range, lng + lng_range),
        )
    )
    sessions = result.scalars().all()

    findings = []
    for session in sessions:
        memories_result = await db.execute(
            select(Memory).where(Memory.session_id == session.id)
        )
        for memory in memories_result.scalars().all():
            findings.append({
                "type": "location_memory",
                "place_name": session.place_name,
                "memory_id": memory.id,
                "memory_summary": memory.summary,
            })
    return findings


async def check_new_capture_connections(
    db: AsyncSession, new_memory_id: str
) -> list[dict]:
    """Check if a newly processed capture connects to existing open threads."""
    new_entities_result = await db.execute(
        select(Entity).where(Entity.memory_id == new_memory_id)
    )
    new_entities = new_entities_result.scalars().all()

    findings = []
    for entity in new_entities:
        related = await db.execute(
            select(Entity, Memory)
            .join(Memory, Entity.memory_id == Memory.id)
            .where(
                Entity.value.ilike(f"%{entity.value}%"),
                Entity.memory_id != new_memory_id,
            )
        )
        for related_entity, related_memory in related.all():
            findings.append({
                "type": "connected_thread",
                "entity_value": entity.value,
                "related_memory_id": related_memory.id,
                "related_summary": related_memory.summary,
            })
    return findings


async def evaluate_triggers(
    db: AsyncSession,
    trigger_type: str,
    lat: float | None = None,
    lng: float | None = None,
    new_memory_id: str | None = None,
) -> list[dict]:
    """
    Main evaluation dispatcher. Runs the appropriate checks based on trigger type.
    Returns a list of findings that should be turned into notifications.
    """
    all_findings = []

    if trigger_type == "location_change" and lat is not None and lng is not None:
        findings = await check_location_memories(db, lat, lng)
        all_findings.extend(findings)

    if trigger_type == "new_capture_complete" and new_memory_id:
        findings = await check_new_capture_connections(db, new_memory_id)
        all_findings.extend(findings)

    commitments = await check_upcoming_commitments(db)
    all_findings.extend(commitments)

    return all_findings
