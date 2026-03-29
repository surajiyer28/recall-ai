from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class EntityRelationship(Base):
    __tablename__ = "entity_relationships"

    source_entity_id: Mapped[str] = mapped_column(
        ForeignKey("entities.id", ondelete="CASCADE")
    )
    target_entity_id: Mapped[str] = mapped_column(
        ForeignKey("entities.id", ondelete="CASCADE")
    )
    relationship_type: Mapped[str] = mapped_column(
        String(50)
    )  # mentioned_by | discussed_at | met_at | assigned_to
    memory_id: Mapped[str] = mapped_column(
        ForeignKey("memories.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    source_entity = relationship(
        "Entity", foreign_keys=[source_entity_id], back_populates="source_relationships"
    )
    target_entity = relationship(
        "Entity", foreign_keys=[target_entity_id], back_populates="target_relationships"
    )

    __table_args__ = (
        Index("ix_entity_rel_source", "source_entity_id"),
        Index("ix_entity_rel_target", "target_entity_id"),
        Index("ix_entity_rel_memory", "memory_id"),
    )
