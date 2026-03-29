import logging

logger = logging.getLogger(__name__)

RRF_K = 60


def reciprocal_rank_fusion(search_results: list[dict]) -> list[dict]:
    """
    Apply Reciprocal Rank Fusion (RRF) to merge results from multiple channels.

    Scoring:
    - Each channel provides a ranked list of memory_ids
    - RRF score = sum(1 / (k + rank_i)) for each channel i where memory appears
    - Results appearing in multiple channels get higher scores

    Confidence assignment:
    - high: surfaced by 2-3 channels with strong match
    - medium: surfaced by 1 channel with moderate match
    - low: weak single-channel match
    """
    vector_ranked = sorted(
        [r for r in search_results if "vector" in r["sources"]],
        key=lambda x: x.get("vector_distance", 999),
    )
    graph_items = [r for r in search_results if "graph" in r["sources"]]
    temporal_items = [r for r in search_results if "temporal" in r["sources"]]

    vector_ranks = {r["memory_id"]: i + 1 for i, r in enumerate(vector_ranked)}
    graph_ranks = {r["memory_id"]: i + 1 for i, r in enumerate(graph_items)}
    temporal_ranks = {r["memory_id"]: i + 1 for i, r in enumerate(temporal_items)}

    all_memory_ids = set(vector_ranks) | set(graph_ranks) | set(temporal_ranks)

    scored = []
    for mid in all_memory_ids:
        rrf_score = 0.0
        channel_count = 0

        if mid in vector_ranks:
            rrf_score += 1.0 / (RRF_K + vector_ranks[mid])
            channel_count += 1
        if mid in graph_ranks:
            rrf_score += 1.0 / (RRF_K + graph_ranks[mid])
            channel_count += 1
        if mid in temporal_ranks:
            rrf_score += 1.0 / (RRF_K + temporal_ranks[mid])
            channel_count += 1

        source_entry = next(
            (r for r in search_results if r["memory_id"] == mid), {}
        )
        vec_dist = source_entry.get("vector_distance", 999)

        if channel_count >= 2 and vec_dist < 0.5:
            confidence = "high"
        elif channel_count >= 2 or vec_dist < 0.3:
            confidence = "high"
        elif channel_count == 1 and vec_dist < 0.5:
            confidence = "medium"
        else:
            confidence = "low"

        scored.append({
            "memory_id": mid,
            "rrf_score": rrf_score,
            "confidence": confidence,
            "channel_count": channel_count,
            "sources": source_entry.get("sources", []),
            "vector_distance": vec_dist,
        })

    scored.sort(key=lambda x: x["rrf_score"], reverse=True)

    return scored
