from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationOut, ContextUpdate
from app.services.proactive.agent import run_proactive_agent

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    delivered: bool | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Notification).order_by(Notification.created_at.desc()).limit(limit)
    if delivered is not None:
        query = query.where(Notification.delivered == delivered)
    result = await db.execute(query)
    return [NotificationOut.model_validate(n) for n in result.scalars().all()]


@router.post("/{notification_id}/deliver", response_model=NotificationOut)
async def mark_delivered(notification_id: str, db: AsyncSession = Depends(get_db)):
    notification = await db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.delivered = True
    await db.commit()
    await db.refresh(notification)
    return NotificationOut.model_validate(notification)


@router.post("/{notification_id}/dismiss")
async def dismiss_notification(notification_id: str, db: AsyncSession = Depends(get_db)):
    notification = await db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.delivered = True
    await db.commit()
    return {"status": "dismissed", "notification_id": notification_id}


@router.post("/trigger")
async def trigger_proactive_agent(
    context: ContextUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger the proactive agent with a context update."""
    result = await run_proactive_agent(
        db=db,
        trigger_type=context.trigger_type,
        lat=context.lat,
        lng=context.lng,
        new_memory_id=context.new_memory_id,
    )
    return result
