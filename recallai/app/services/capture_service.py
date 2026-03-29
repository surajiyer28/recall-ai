from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.capture_session import CaptureSession
from app.models.memory import Memory
from app.models.processing_queue import ProcessingQueueJob

VALID_TRANSITIONS = {
    "recording": {"processing", "failed"},
    "processing": {"stored", "failed"},
    "stored": set(),
    "failed": {"processing"},
}

OVERRIDE_STATES = {"privacy_zone", "quiet_hours", "paused", "offline"}


# ---------------------------------------------------------------------------
# Global capture state
# ---------------------------------------------------------------------------
class CaptureState:
    """Tracks the global capture status and the currently-active recording session."""

    def __init__(self):
        self.status: str = "active"  # active | paused | privacy_zone | quiet_hours | offline
        self.active_session_id: str | None = None

    def is_capture_allowed(self) -> bool:
        return self.status == "active"


_capture_state = CaptureState()


def get_capture_state() -> CaptureState:
    return _capture_state


async def create_session(
    db: AsyncSession,
    trigger: str,
    status: str = "recording",
    place_name: Optional[str] = None,
    gps_lat: Optional[float] = None,
    gps_lng: Optional[float] = None,
) -> CaptureSession:
    session = CaptureSession(
        trigger=trigger,
        status=status,
        place_name=place_name,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def transition_session(
    db: AsyncSession, session_id: str, new_status: str
) -> CaptureSession:
    session = await db.get(CaptureSession, session_id)
    if session is None:
        raise ValueError(f"Session {session_id} not found")

    if new_status not in OVERRIDE_STATES:
        allowed = VALID_TRANSITIONS.get(session.status, set())
        if new_status not in allowed:
            raise ValueError(
                f"Cannot transition from '{session.status}' to '{new_status}'"
            )

    session.status = new_status
    if new_status in ("stored", "failed"):
        session.ended_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(session)
    return session


async def get_session(db: AsyncSession, session_id: str) -> Optional[CaptureSession]:
    return await db.get(CaptureSession, session_id)


async def list_sessions(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> tuple[list[CaptureSession], int]:
    total_q = await db.execute(select(func.count(CaptureSession.id)))
    total = total_q.scalar_one()

    result = await db.execute(
        select(CaptureSession)
        .order_by(CaptureSession.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    sessions = list(result.scalars().all())
    return sessions, total


async def create_memory_for_session(
    db: AsyncSession,
    session_id: str,
    capture_trigger: str,
    image_refs: Optional[dict] = None,
) -> Memory:
    memory = Memory(
        session_id=session_id,
        capture_trigger=capture_trigger,
        image_refs=image_refs,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    return memory


async def enqueue_jobs(
    db: AsyncSession, session_id: str, job_types: list[str], payload_path: Optional[str] = None
) -> list[ProcessingQueueJob]:
    jobs = []
    for job_type in job_types:
        job = ProcessingQueueJob(
            session_id=session_id,
            job_type=job_type,
            payload_path=payload_path,
        )
        db.add(job)
        jobs.append(job)
    await db.commit()
    for job in jobs:
        await db.refresh(job)
    return jobs


async def get_queue_jobs(
    db: AsyncSession, session_id: Optional[str] = None, status: Optional[str] = None
) -> list[ProcessingQueueJob]:
    query = select(ProcessingQueueJob).order_by(ProcessingQueueJob.created_at)
    if session_id:
        query = query.where(ProcessingQueueJob.session_id == session_id)
    if status:
        query = query.where(ProcessingQueueJob.status == status)
    result = await db.execute(query)
    return list(result.scalars().all())
