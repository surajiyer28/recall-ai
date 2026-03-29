from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.demo.seed_data import DEMO_CAPTURES, load_demo_data
from app.models.memory import Memory
from app.models.entity import Entity
from app.models.capture_session import CaptureSession

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed")
async def seed_demo_data():
    """Load demo captures into the database (no API keys required)."""
    await load_demo_data()
    return {"status": "ok", "captures_loaded": len(DEMO_CAPTURES)}


@router.get("/verify")
async def verify_demo_data(db: AsyncSession = Depends(get_db)):
    """Verify demo data was loaded correctly."""
    sessions_count = (await db.execute(select(func.count(CaptureSession.id)))).scalar_one()
    memories_count = (await db.execute(select(func.count(Memory.id)))).scalar_one()
    entities_count = (await db.execute(select(func.count(Entity.id)))).scalar_one()

    sample_entities = await db.execute(
        select(Entity.type, Entity.value).limit(10)
    )
    entity_samples = [{"type": r[0], "value": r[1]} for r in sample_entities.all()]

    sample_memories = await db.execute(
        select(Memory.id, Memory.summary).where(Memory.summary.isnot(None)).limit(6)
    )
    memory_summaries = [{"id": r[0], "summary": r[1][:80]} for r in sample_memories.all()]

    return {
        "sessions": sessions_count,
        "memories": memories_count,
        "entities": entities_count,
        "sample_entities": entity_samples,
        "memory_summaries": memory_summaries,
    }
