import logging
from datetime import datetime, timedelta, timezone

from anthropic import Anthropic
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.notification import Notification

logger = logging.getLogger(__name__)

NOTIFICATION_SYSTEM = """You are RecallAI's proactive memory agent. Generate a single concise notification (1-2 sentences max) that helps the user remember something important.

Be specific: include names, dates, and places. Be warm but brief. This is a push notification, not a conversation."""

BATCH_WINDOW_MINUTES = 5


class NotificationGenerator:
    def __init__(self):
        settings = get_settings()
        self._client = None
        self._api_key = settings.anthropic_api_key

    @property
    def client(self) -> Anthropic:
        if self._client is None:
            if not self._api_key:
                raise RuntimeError("ANTHROPIC_API_KEY not set.")
            self._client = Anthropic(api_key=self._api_key)
        return self._client

    def generate_message(self, findings: list[dict]) -> str:
        """Generate a concise notification message from trigger findings."""
        if not findings:
            return ""

        context = "\n".join(
            f"- {f.get('type', 'unknown')}: {f.get('entity_value', '')} "
            f"({f.get('memory_summary', 'no summary')})"
            for f in findings[:5]
        )

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=150,
                system=NOTIFICATION_SYSTEM,
                messages=[{
                    "role": "user",
                    "content": f"Generate a notification based on these findings:\n{context}",
                }],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error("Notification generation failed: %s", e)
            finding = findings[0]
            return f"Reminder: {finding.get('entity_value', 'Something')} — {finding.get('memory_summary', '')}"


async def should_batch(db: AsyncSession) -> bool:
    """Check if there are recent undelivered notifications within the batch window."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=BATCH_WINDOW_MINUTES)
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.delivered == False,
            Notification.created_at >= cutoff,
        )
    )
    count = result.scalar_one()
    return count > 0


async def create_notification(
    db: AsyncSession,
    trigger_type: str,
    message: str,
    memory_id: str | None = None,
) -> Notification:
    notification = Notification(
        memory_id=memory_id,
        trigger_type=trigger_type,
        message=message,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


_notification_generator: NotificationGenerator | None = None


def get_notification_generator() -> NotificationGenerator:
    global _notification_generator
    if _notification_generator is None:
        _notification_generator = NotificationGenerator()
    return _notification_generator
