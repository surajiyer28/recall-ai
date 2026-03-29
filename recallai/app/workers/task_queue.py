import logging

from app.models.database import async_session_factory
from app.services.processing.pipeline import run_pipeline

logger = logging.getLogger(__name__)


async def run_pipeline_background(
    session_id: str, media_type: str, payload_path: str
) -> None:
    """
    Background task that creates its own DB session and runs the full
    processing pipeline for a capture session.
    """
    try:
        async with async_session_factory() as db:
            await run_pipeline(db, session_id, media_type, payload_path)
    except Exception as e:
        logger.error(
            "Background pipeline failed for session %s: %s", session_id, e
        )
