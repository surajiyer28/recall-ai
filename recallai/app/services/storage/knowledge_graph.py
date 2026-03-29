import logging
from typing import Optional

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entity import Entity
from app.models.knowledge_graph import EntityRelationship
from app.models.memory import Memory

logger = logging.getLogger(__name__)


async def find_entities_by_value(
    db: AsyncSession, value: str, entity_type: Optional[str] = None
) -> list[Entity]:
    """Find entities matching a value (case-insensitive partial match)."""
    query = select(Entity).where(Entity.value.ilike(f"%{value}%"))
    if entity_type:
        query = query.where(Entity.type == entity_type)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_connected_memories(
    db: AsyncSession, entity_ids: list[str]
) -> list[str]:
    """
    Traverse knowledge graph from given entity IDs.
    Returns memory IDs connected via entity_relationships.
    """
    if not entity_ids:
        return []

    result = await db.execute(
        select(EntityRelationship.memory_id).where(
            or_(
                EntityRelationship.source_entity_id.in_(entity_ids),
                EntityRelationship.target_entity_id.in_(entity_ids),
            )
        ).distinct()
    )
    return [row[0] for row in result.all()]


async def get_entity_neighbors(
    db: AsyncSession, entity_id: str
) -> list[dict]:
    """
    Get all entities connected to a given entity via relationships.
    Returns list of {entity, relationship_type, direction}.
    """
    outgoing = await db.execute(
        select(EntityRelationship).where(
            EntityRelationship.source_entity_id == entity_id
        )
    )
    incoming = await db.execute(
        select(EntityRelationship).where(
            EntityRelationship.target_entity_id == entity_id
        )
    )

    neighbors = []
    for rel in outgoing.scalars().all():
        target = await db.get(Entity, rel.target_entity_id)
        if target:
            neighbors.append({
                "entity_id": target.id,
                "entity_type": target.type,
                "entity_value": target.value,
                "relationship_type": rel.relationship_type,
                "direction": "outgoing",
                "memory_id": rel.memory_id,
            })

    for rel in incoming.scalars().all():
        source = await db.get(Entity, rel.source_entity_id)
        if source:
            neighbors.append({
                "entity_id": source.id,
                "entity_type": source.type,
                "entity_value": source.value,
                "relationship_type": rel.relationship_type,
                "direction": "incoming",
                "memory_id": rel.memory_id,
            })

    return neighbors


async def get_memories_for_entity_value(
    db: AsyncSession, value: str, entity_type: Optional[str] = None
) -> list[str]:
    """
    High-level graph query: find entity by value -> traverse to connected memories.
    Used by the retrieval layer for entity-based queries.
    """
    entities = await find_entities_by_value(db, value, entity_type)
    if not entities:
        return []

    entity_ids = [e.id for e in entities]
    direct_memory_ids = [e.memory_id for e in entities]

    graph_memory_ids = await get_connected_memories(db, entity_ids)

    all_memory_ids = list(set(direct_memory_ids + graph_memory_ids))
    return all_memory_ids


async def get_entities_for_memory(
    db: AsyncSession, memory_id: str
) -> list[Entity]:
    result = await db.execute(
        select(Entity).where(Entity.memory_id == memory_id)
    )
    return list(result.scalars().all())
