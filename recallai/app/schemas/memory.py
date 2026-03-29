from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MemoryOut(BaseModel):
    id: str
    session_id: str
    created_at: datetime
    summary: Optional[str] = None
    transcript: Optional[str] = None
    image_refs: Optional[dict] = None
    confidence: Optional[float] = None
    duration_sec: Optional[int] = None
    noise_level: Optional[str] = None
    source_device: Optional[str] = None
    capture_trigger: Optional[str] = None

    model_config = {"from_attributes": True}


class MemoryDetail(MemoryOut):
    entities: list["EntityBrief"] = []


class EntityBrief(BaseModel):
    id: str
    type: str
    value: str

    model_config = {"from_attributes": True}


MemoryDetail.model_rebuild()
