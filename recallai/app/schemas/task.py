from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TaskOut(BaseModel):
    id: str
    memory_id: str
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    deadline: Optional[datetime] = None
