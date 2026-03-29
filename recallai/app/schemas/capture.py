from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CaptureContext(BaseModel):
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    place_name: Optional[str] = None
    source_device: Optional[str] = None


class CaptureSessionOut(BaseModel):
    id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    trigger: str
    status: str
    place_name: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    speaker_count: int

    model_config = {"from_attributes": True}


class CaptureSessionList(BaseModel):
    sessions: list[CaptureSessionOut]
    total: int


class UploadResponse(BaseModel):
    session_id: str
    status: str
    message: str
    jobs_queued: list[str] = Field(default_factory=list)


class RecordStartResponse(BaseModel):
    session_id: str
    status: str


class CaptureStatusOut(BaseModel):
    capture_status: str  # active | paused | privacy_zone | quiet_hours | offline
    active_session_id: Optional[str] = None


class ProcessingQueueJobOut(BaseModel):
    id: str
    session_id: str
    job_type: str
    status: str
    retry_count: int
    created_at: datetime
    last_attempted: Optional[datetime] = None

    model_config = {"from_attributes": True}
