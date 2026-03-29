import logging
import re
from typing import Optional

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity
from app.models.knowledge_graph import EntityRelationship

logger = logging.getLogger(__name__)

_nlp = None

SPACY_LABEL_TO_TYPE = {
    "PERSON": "person",
    "GPE": "place",
    "LOC": "place",
    "FAC": "place",
    "ORG": "object",
    "PRODUCT": "object",
    "WORK_OF_ART": "object",
    "EVENT": "object",
    "DATE": "date",
    "TIME": "date",
}

ACTION_PATTERNS = [
    re.compile(r"(?:need to|have to|must|should|don't forget to|remember to)\s+(.+?)(?:\.|$)", re.I),
    re.compile(r"(?:deadline|due|by)\s+(?:is\s+)?(.+?)(?:\.|$)", re.I),
    re.compile(r"(?:follow up|follow-up)\s+(?:with|on)\s+(.+?)(?:\.|$)", re.I),
]

FUZZY_MATCH_THRESHOLD = 85


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy
            try:
                _nlp = spacy.load("en_core_web_trf")
            except OSError:
                try:
                    _nlp = spacy.load("en_core_web_sm")
                except OSError:
                    logger.warning(
                        "No SpaCy model found. Run: python -m spacy download en_core_web_sm"
                    )
                    return None
        except ImportError:
            logger.warning("SpaCy not installed. NER will be skipped.")
            return None
    return _nlp


def extract_entities(text: str) -> list[dict]:
    """
    Extract named entities from text using SpaCy NER.
    Also extracts action items via regex patterns.
    Returns list of {type, value} dicts.
    """
    if not text or not text.strip():
        return []

    entities = []
    seen_values = set()

    nlp = _get_nlp()
    if nlp:
        doc = nlp(text)
        for ent in doc.ents:
            entity_type = SPACY_LABEL_TO_TYPE.get(ent.label_)
            if entity_type and ent.text.strip():
                value = ent.text.strip()
                if value.lower() not in seen_values:
                    entities.append({"type": entity_type, "value": value})
                    seen_values.add(value.lower())

    for pattern in ACTION_PATTERNS:
        matches = pattern.findall(text)
        for match in matches:
            value = match.strip()
            if value and value.lower() not in seen_values:
                entities.append({"type": "action_item", "value": value})
                seen_values.add(value.lower())

    return entities


async def find_matching_entity(
    db: AsyncSession, entity_type: str, entity_value: str
) -> Optional[Entity]:
    """
    Find an existing entity with the same type and similar value using fuzzy matching.
    Returns the best match above FUZZY_MATCH_THRESHOLD, or None.
    """
    result = await db.execute(
        select(Entity).where(Entity.type == entity_type)
    )
    existing = result.scalars().all()

    best_match = None
    best_score = 0.0

    for entity in existing:
        score = fuzz.ratio(entity_value.lower(), entity.value.lower())
        if score >= FUZZY_MATCH_THRESHOLD and score > best_score:
            best_match = entity
            best_score = score

    return best_match


async def store_entities(
    db: AsyncSession, memory_id: str, entities: list[dict]
) -> list[Entity]:
    """
    Store extracted entities in the database. Links to existing entities
    via fuzzy matching (entity linking / resolution).
    """
    stored = []
    for ent_data in entities:
        existing = await find_matching_entity(
            db, ent_data["type"], ent_data["value"]
        )
        resolved_id = existing.id if existing else None

        entity = Entity(
            memory_id=memory_id,
            type=ent_data["type"],
            value=ent_data["value"],
            resolved_id=resolved_id,
        )
        db.add(entity)
        stored.append(entity)

    await db.commit()
    for e in stored:
        await db.refresh(e)
    return stored


async def build_entity_relationships(
    db: AsyncSession, memory_id: str, entities: list[Entity]
) -> list[EntityRelationship]:
    """
    Create relationship edges between entities found in the same memory.
    Person -> Object/Place = mentioned_by/discussed_at.
    """
    relationships = []
    persons = [e for e in entities if e.type == "person"]
    non_persons = [e for e in entities if e.type != "person"]

    for person in persons:
        for other in non_persons:
            rel_type = {
                "place": "discussed_at",
                "object": "mentioned_by",
                "date": "mentioned_by",
                "action_item": "assigned_to",
            }.get(other.type, "mentioned_by")

            rel = EntityRelationship(
                source_entity_id=person.id,
                target_entity_id=other.id,
                relationship_type=rel_type,
                memory_id=memory_id,
            )
            db.add(rel)
            relationships.append(rel)

    if relationships:
        await db.commit()

    return relationships
