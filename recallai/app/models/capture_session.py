from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class CaptureSession(Base):
    __tablename__ = "capture_sessions"

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), default=None
    )
    trigger: Mapped[str] = mapped_column(String(20))  # 'vad' | 'manual_upload'
    status: Mapped[str] = mapped_column(
        String(20), default="recording"
    )  # recording | processing | stored | failed
    place_name: Mapped[Optional[str]] = mapped_column(Text, default=None)
    gps_lat: Mapped[Optional[float]] = mapped_column(Float, default=None)
    gps_lng: Mapped[Optional[float]] = mapped_column(Float, default=None)
    speaker_count: Mapped[int] = mapped_column(Integer, default=1)

    memories = relationship("Memory", back_populates="session", cascade="all, delete-orphan")
    queue_jobs = relationship("ProcessingQueueJob", back_populates="session", cascade="all, delete-orphan")
