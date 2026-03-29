import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.proactive.trigger_evaluator import evaluate_triggers
from app.services.proactive.notification_service import (
    get_notification_generator,
    create_notification,
    should_batch,
)

logger = logging.getLogger(__name__)


async def run_proactive_agent(
    db: AsyncSession,
    trigger_type: str,
    lat: float | None = None,
    lng: float | None = None,
    new_memory_id: str | None = None,
) -> dict:
    """
    Main proactive agent entry point. Called on context change events.
    Evaluates triggers, generates notification if warranted, batches if needed.
    """
    findings = await evaluate_triggers(
        db,
        trigger_type=trigger_type,
        lat=lat,
        lng=lng,
        new_memory_id=new_memory_id,
    )

    if not findings:
        return {"triggered": False, "notification": None}

    if await should_batch(db):
        logger.info("Batching notification — recent undelivered notifications exist")
        return {"triggered": True, "notification": None, "batched": True}

    generator = get_notification_generator()
    message = generator.generate_message(findings)

    if not message:
        return {"triggered": True, "notification": None}

    memory_id = findings[0].get("memory_id") or findings[0].get("related_memory_id")
    notification = await create_notification(
        db,
        trigger_type=trigger_type,
        message=message,
        memory_id=memory_id,
    )

    logger.info("Proactive notification created: %s", notification.id)

    return {
        "triggered": True,
        "notification": {
            "id": notification.id,
            "message": notification.message,
            "trigger_type": notification.trigger_type,
        },
    }
