from typing import Optional

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class Entity(Base):
    __tablename__ = "entities"

    memory_id: Mapped[str] = mapped_column(
        ForeignKey("memories.id", ondelete="CASCADE")
    )
    type: Mapped[str] = mapped_column(
        String(20)
    )  # person | place | object | date | action_item
    value: Mapped[str] = mapped_column(Text)
    resolved_id: Mapped[Optional[str]] = mapped_column(String(36), default=None)

    memory = relationship("Memory", back_populates="entities")

    source_relationships = relationship(
        "EntityRelationship",
        foreign_keys="EntityRelationship.source_entity_id",
        back_populates="source_entity",
        cascade="all, delete-orphan",
    )
    target_relationships = relationship(
        "EntityRelationship",
        foreign_keys="EntityRelationship.target_entity_id",
        back_populates="target_entity",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_entities_memory_id", "memory_id"),
        Index("ix_entities_type_value", "type", "value"),
    )
