from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TimelineEntry(BaseModel):
    id: str
    created_at: datetime
    summary: Optional[str] = None
    place_name: Optional[str] = None
    duration_sec: Optional[int] = None
    capture_trigger: Optional[str] = None
    entity_tags: list[str] = []
    memory_type: str = "unknown"
    action_item_count: int = 0
    has_images: bool = False

    model_config = {"from_attributes": True}


class TimelineResponse(BaseModel):
    date: str
    entries: list[TimelineEntry]
    total: int


class MemoryStatsResponse(BaseModel):
    today_count: int
    total_count: int
    by_type: dict[str, int]
    by_entity_type: dict[str, int]
