from fastapi import APIRouter

from app.api.v1.endpoints import health, capture, chat, timeline, memories, notifications, privacy, demo, tasks, people

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(capture.router)
api_router.include_router(chat.router)
api_router.include_router(timeline.router)
api_router.include_router(memories.router)
api_router.include_router(notifications.router)
api_router.include_router(privacy.router)
api_router.include_router(demo.router)
api_router.include_router(tasks.router)
api_router.include_router(people.router)

