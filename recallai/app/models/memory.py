from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class Memory(Base):
    __tablename__ = "memories"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("capture_sessions.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, default=None)
    transcript: Mapped[Optional[str]] = mapped_column(Text, default=None)
    image_refs: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    confidence: Mapped[Optional[float]] = mapped_column(Float, default=None)
    synced: Mapped[int] = mapped_column(Integer, default=0)
    duration_sec: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    noise_level: Mapped[Optional[str]] = mapped_column(
        String(20), default=None
    )  # quiet | moderate | loud
    source_device: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    capture_trigger: Mapped[Optional[str]] = mapped_column(
        String(20), default=None
    )  # vad | manual_upload

    session = relationship("CaptureSession", back_populates="memories")
    entities = relationship("Entity", back_populates="memory", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="memory", cascade="all, delete-orphan")
