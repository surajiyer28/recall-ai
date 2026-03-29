from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.privacy_zone import PrivacyZone
from app.models.memory import Memory
from app.models.entity import Entity
from app.models.capture_session import CaptureSession
from app.models.notification import Notification
from app.models.processing_queue import ProcessingQueueJob
from app.models.knowledge_graph import EntityRelationship
from app.schemas.privacy import (
    PrivacyZoneCreate,
    PrivacyZoneOut,
    QuietHoursSettings,
    RetentionPolicy,
    DataExport,
)
from app.services.storage.vector_store import delete_memory_vectors, get_collection_count

router = APIRouter(prefix="/privacy", tags=["privacy"])

_quiet_hours: QuietHoursSettings | None = None
_retention: RetentionPolicy = RetentionPolicy()


@router.post("/zones", response_model=PrivacyZoneOut)
async def create_privacy_zone(
    zone: PrivacyZoneCreate, db: AsyncSession = Depends(get_db)
):
    db_zone = PrivacyZone(
        name=zone.name,
        gps_lat=zone.gps_lat,
        gps_lng=zone.gps_lng,
        radius_metres=zone.radius_metres,
    )
    db.add(db_zone)
    await db.commit()
    await db.refresh(db_zone)
    return PrivacyZoneOut.model_validate(db_zone)


@router.get("/zones", response_model=list[PrivacyZoneOut])
async def list_privacy_zones(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PrivacyZone))
    return [PrivacyZoneOut.model_validate(z) for z in result.scalars().all()]


@router.delete("/zones/{zone_id}")
async def delete_privacy_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    zone = await db.get(PrivacyZone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Privacy zone not found")
    await db.delete(zone)
    await db.commit()
    return {"status": "deleted", "zone_id": zone_id}


@router.post("/quiet-hours", response_model=QuietHoursSettings)
async def set_quiet_hours(settings: QuietHoursSettings):
    global _quiet_hours
    _quiet_hours = settings
    return _quiet_hours


@router.get("/quiet-hours", response_model=QuietHoursSettings | None)
async def get_quiet_hours():
    return _quiet_hours


@router.post("/retention", response_model=RetentionPolicy)
async def set_retention(policy: RetentionPolicy):
    global _retention
    _retention = policy
    return _retention


@router.get("/retention", response_model=RetentionPolicy)
async def get_retention():
    return _retention


@router.post("/retention/sweep")
async def sweep_expired_memories(db: AsyncSession = Depends(get_db)):
    """Delete memories older than retention policy allows (casual only)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=_retention.casual_days)

    old_memories = await db.execute(
        select(Memory).where(
            Memory.created_at < cutoff,
            Memory.confidence.is_(None) | (Memory.confidence < 0.8),
        )
    )
    deleted_count = 0
    for memory in old_memories.scalars().all():
        delete_memory_vectors(memory.id)
        await db.delete(memory)
        deleted_count += 1

    await db.commit()
    return {"swept": deleted_count, "cutoff_date": cutoff.isoformat()}


@router.get("/export", response_model=DataExport)
async def export_all_data(db: AsyncSession = Depends(get_db)):
    """Export entire memory store as JSON."""
    memories_result = await db.execute(select(Memory))
    memories = memories_result.scalars().all()

    entities_result = await db.execute(select(Entity))
    entities = entities_result.scalars().all()

    sessions_result = await db.execute(select(CaptureSession))
    sessions = sessions_result.scalars().all()

    export = {
        "memories": [
            {
                "id": m.id,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "summary": m.summary,
                "transcript": m.transcript,
                "image_refs": m.image_refs,
            }
            for m in memories
        ],
        "entities": [
            {"id": e.id, "type": e.type, "value": e.value, "memory_id": e.memory_id}
            for e in entities
        ],
        "sessions": [
            {
                "id": s.id,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "trigger": s.trigger,
                "status": s.status,
                "place_name": s.place_name,
            }
            for s in sessions
        ],
    }

    return DataExport(
        memories_count=len(memories),
        entities_count=len(entities),
        sessions_count=len(sessions),
        export_data=export,
    )


@router.delete("/all-data")
async def delete_all_data(db: AsyncSession = Depends(get_db)):
    """Nuclear option: delete all user data from all stores."""
    memories_result = await db.execute(select(Memory.id))
    for row in memories_result.all():
        delete_memory_vectors(row[0])

    from app.models.task import Task
    from app.models.person import PersonHighlight, Person
    await db.execute(delete(PersonHighlight))
    await db.execute(delete(Task))
    await db.execute(delete(Person))
    await db.execute(delete(EntityRelationship))
    await db.execute(delete(Entity))
    await db.execute(delete(Notification))
    await db.execute(delete(ProcessingQueueJob))
    await db.execute(delete(Memory))
    await db.execute(delete(CaptureSession))
    await db.execute(delete(PrivacyZone))
    await db.commit()

    return {"status": "all_data_deleted"}
