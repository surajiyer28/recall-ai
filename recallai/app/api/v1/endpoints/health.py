from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_chroma_client, get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    status = {"status": "ok", "postgres": "unknown", "chromadb": "unknown"}

    try:
        await db.execute(text("SELECT 1"))
        status["postgres"] = "connected"
    except Exception as e:
        status["postgres"] = f"error: {e}"
        status["status"] = "degraded"

    try:
        client = get_chroma_client()
        client.heartbeat()
        status["chromadb"] = "connected"
    except Exception as e:
        status["chromadb"] = f"error: {e}"
        status["status"] = "degraded"

    return status
