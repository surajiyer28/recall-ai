from typing import Optional

from pydantic import BaseModel


class PrivacyZoneCreate(BaseModel):
    name: str
    gps_lat: float
    gps_lng: float
    radius_metres: float = 50.0


class PrivacyZoneOut(BaseModel):
    id: str
    name: str
    gps_lat: float
    gps_lng: float
    radius_metres: float

    model_config = {"from_attributes": True}


class QuietHoursSettings(BaseModel):
    start_hour: int  # 0-23
    start_minute: int = 0
    end_hour: int  # 0-23
    end_minute: int = 0
    enabled: bool = True


class RetentionPolicy(BaseModel):
    casual_days: int = 30
    important_indefinite: bool = True


class DataExport(BaseModel):
    memories_count: int
    entities_count: int
    sessions_count: int
    export_data: dict
