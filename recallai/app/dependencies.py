import chromadb
from chromadb.api import ClientAPI

from app.config import Settings, get_settings
from app.models.database import async_session_factory

_chroma_client: ClientAPI | None = None

CHROMA_COLLECTION_NAME = "recallai_memories"
EMBEDDING_DIM = 1408


async def get_db():
    async with async_session_factory() as session:
        yield session


def get_chroma_client() -> ClientAPI:
    global _chroma_client
    if _chroma_client is None:
        settings = get_settings()
        ssl = settings.chroma_port == 443
        _chroma_client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
            ssl=ssl,
        )
    return _chroma_client


def get_chroma_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=CHROMA_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
