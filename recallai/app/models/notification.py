from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    memory_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("memories.id", ondelete="SET NULL"), default=None
    )
    trigger_type: Mapped[str] = mapped_column(
        String(30)
    )  # location_change | new_capture_complete | calendar_overlap
    message: Mapped[str] = mapped_column(Text)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    memory = relationship("Memory", back_populates="notifications")
