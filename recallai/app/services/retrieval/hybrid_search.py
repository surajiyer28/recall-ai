import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.processing.embedding_service import get_embedding_service
from app.services.storage.vector_store import search_similar
from app.services.storage.knowledge_graph import get_memories_for_entity_value
from app.services.storage.temporal_index import search_by_time_range

logger = logging.getLogger(__name__)


async def vector_search(query_text: str, top_k: int = 20) -> list[dict]:
    """Channel 1: embed query text and search ChromaDB for similar vectors."""
    try:
        embedding_svc = get_embedding_service()
        query_vec = embedding_svc.embed_text(query_text)
        hits = search_similar(query_vec, top_k=top_k)
        return hits
    except Exception as e:
        logger.error("Vector search failed: %s", e)
        return []


async def graph_search(
    db: AsyncSession, entities: list[str]
) -> list[str]:
    """Channel 2: look up entities in knowledge graph, return connected memory IDs."""
    all_memory_ids = set()
    for entity_value in entities:
        try:
            memory_ids = await get_memories_for_entity_value(db, entity_value)
            all_memory_ids.update(memory_ids)
        except Exception as e:
            logger.error("Graph search failed for '%s': %s", entity_value, e)
    return list(all_memory_ids)


async def temporal_search(
    db: AsyncSession,
    time_start: datetime | None,
    time_end: datetime | None,
) -> list[str]:
    """Channel 3: filter memories by time range."""
    if time_start is None or time_end is None:
        return []
    try:
        return await search_by_time_range(db, time_start, time_end)
    except Exception as e:
        logger.error("Temporal search failed: %s", e)
        return []


async def hybrid_search(
    db: AsyncSession,
    query_text: str,
    entities: list[str],
    time_start: datetime | None,
    time_end: datetime | None,
    top_k: int = 20,
) -> list[dict]:
    """
    Execute three search channels in parallel and merge results.
    Returns list of {memory_id, sources, vector_distance}.
    """
    vec_results = await vector_search(query_text, top_k=top_k)
    graph_memory_ids = await graph_search(db, entities)
    temporal_memory_ids = await temporal_search(db, time_start, time_end)

    memory_scores: dict[str, dict] = {}

    for hit in vec_results:
        mid = hit["memory_id"]
        if mid not in memory_scores:
            memory_scores[mid] = {
                "memory_id": mid,
                "sources": set(),
                "vector_distance": hit["distance"],
                "modality": hit.get("modality", ""),
            }
        memory_scores[mid]["sources"].add("vector")
        if hit["distance"] < memory_scores[mid].get("vector_distance", 999):
            memory_scores[mid]["vector_distance"] = hit["distance"]

    for mid in graph_memory_ids:
        if mid not in memory_scores:
            memory_scores[mid] = {
                "memory_id": mid,
                "sources": set(),
                "vector_distance": 999,
                "modality": "",
            }
        memory_scores[mid]["sources"].add("graph")

    for mid in temporal_memory_ids:
        if mid not in memory_scores:
            memory_scores[mid] = {
                "memory_id": mid,
                "sources": set(),
                "vector_distance": 999,
                "modality": "",
            }
        memory_scores[mid]["sources"].add("temporal")

    for mid, data in memory_scores.items():
        data["sources"] = list(data["sources"])

    return list(memory_scores.values())
