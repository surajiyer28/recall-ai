from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class ProcessingQueueJob(Base):
    __tablename__ = "processing_queue"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("capture_sessions.id", ondelete="CASCADE")
    )
    job_type: Mapped[str] = mapped_column(
        String(30)
    )  # whisper | embedding | ner | summarise | frame_extract | ocr
    payload_path: Mapped[Optional[str]] = mapped_column(Text, default=None)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending | in_flight | done | failed
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_attempted: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), default=None
    )

    session = relationship("CaptureSession", back_populates="queue_jobs")

    __table_args__ = (Index("ix_queue_status", "status"),)
