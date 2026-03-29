from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class Person(Base):
    __tablename__ = "people"

    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    highlights = relationship(
        "PersonHighlight", back_populates="person", cascade="all, delete-orphan"
    )
    tasks = relationship("Task", back_populates="person")


class PersonHighlight(Base):
    __tablename__ = "people_highlights"

    person_id: Mapped[str] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE")
    )
    memory_id: Mapped[str] = mapped_column(
        ForeignKey("memories.id", ondelete="CASCADE")
    )
    highlight: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    person = relationship("Person", back_populates="highlights")
    memory = relationship("Memory")
