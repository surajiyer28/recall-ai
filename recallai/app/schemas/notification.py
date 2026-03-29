from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    memory_id: Optional[str] = None
    trigger_type: str
    message: str
    delivered: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ContextUpdate(BaseModel):
    trigger_type: str  # location_change | new_capture_complete | calendar_overlap
    lat: Optional[float] = None
    lng: Optional[float] = None
    new_memory_id: Optional[str] = None
    calendar_event_title: Optional[str] = None
