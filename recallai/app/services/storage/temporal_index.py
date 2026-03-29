import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import Memory

logger = logging.getLogger(__name__)


async def search_by_time_range(
    db: AsyncSession,
    start: datetime,
    end: datetime,
    limit: int = 50,
) -> list[str]:
    """Return memory IDs within a time range, most recent first."""
    result = await db.execute(
        select(Memory.id)
        .where(Memory.created_at >= start, Memory.created_at <= end)
        .order_by(Memory.created_at.desc())
        .limit(limit)
    )
    return [row[0] for row in result.all()]


async def get_recent_memories(
    db: AsyncSession, limit: int = 20
) -> list[str]:
    """Return the most recent memory IDs."""
    result = await db.execute(
        select(Memory.id).order_by(Memory.created_at.desc()).limit(limit)
    )
    return [row[0] for row in result.all()]
