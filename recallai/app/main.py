from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import get_settings
from app.dependencies import get_chroma_collection


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_chroma_collection()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="RecallAI",
        description="AI-Powered Memory Prosthetic for ADHD",
        version="0.1.0",
        debug=settings.debug,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    return app


app = create_app()
