import logging
from datetime import datetime

from app.dependencies import get_chroma_collection, EMBEDDING_DIM

logger = logging.getLogger(__name__)


def add_memory_vectors(
    memory_id: str,
    session_id: str,
    timestamp: datetime,
    text_embedding: list[float] | None = None,
    ocr_embeddings: list[list[float]] | None = None,
) -> int:
    """
    Store embeddings in ChromaDB. Each vector gets a unique ID and metadata
    linking it back to the memory. Returns count of vectors added.
    """
    collection = get_chroma_collection()
    ids = []
    embeddings = []
    metadatas = []

    ts_str = timestamp.isoformat() if timestamp else ""

    if text_embedding and any(v != 0.0 for v in text_embedding):
        ids.append(f"{memory_id}_text")
        embeddings.append(text_embedding)
        metadatas.append({
            "memory_id": memory_id,
            "session_id": session_id,
            "modality": "text",
            "timestamp": ts_str,
        })

    if ocr_embeddings:
        for i, emb in enumerate(ocr_embeddings):
            if any(v != 0.0 for v in emb):
                ids.append(f"{memory_id}_ocr_{i}")
                embeddings.append(emb)
                metadatas.append({
                    "memory_id": memory_id,
                    "session_id": session_id,
                    "modality": "ocr",
                    "timestamp": ts_str,
                })

    if not ids:
        logger.warning("No valid embeddings to store for memory %s", memory_id)
        return 0

    collection.upsert(ids=ids, embeddings=embeddings, metadatas=metadatas)
    logger.info("Stored %d vectors for memory %s", len(ids), memory_id)
    return len(ids)


def search_similar(
    query_embedding: list[float],
    top_k: int = 20,
    where: dict | None = None,
) -> list[dict]:
    """
    Search ChromaDB for nearest vectors. Returns list of
    {memory_id, distance, modality, timestamp, session_id}.
    """
    collection = get_chroma_collection()

    kwargs = {"query_embeddings": [query_embedding], "n_results": top_k}
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)

    hits = []
    if results and results["ids"] and results["ids"][0]:
        for i, vec_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            distance = results["distances"][0][i] if results["distances"] else 0.0
            hits.append({
                "vector_id": vec_id,
                "memory_id": meta.get("memory_id", ""),
                "session_id": meta.get("session_id", ""),
                "modality": meta.get("modality", ""),
                "timestamp": meta.get("timestamp", ""),
                "distance": distance,
            })

    return hits


def delete_memory_vectors(memory_id: str) -> None:
    """Delete all vectors associated with a memory."""
    collection = get_chroma_collection()
    try:
        collection.delete(where={"memory_id": memory_id})
    except Exception as e:
        logger.error("Failed to delete vectors for memory %s: %s", memory_id, e)


def get_collection_count() -> int:
    collection = get_chroma_collection()
    return collection.count()
