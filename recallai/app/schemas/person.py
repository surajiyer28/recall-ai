from datetime import datetime

from pydantic import BaseModel


class PersonSummaryOut(BaseModel):
    id: str
    name: str
    highlight_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PersonHighlightOut(BaseModel):
    id: str
    highlight: str
    memory_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
