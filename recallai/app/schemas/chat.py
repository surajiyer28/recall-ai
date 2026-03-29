from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class SourceMemory(BaseModel):
    id: str
    created_at: Optional[str] = None
    place_name: Optional[str] = None
    summary: Optional[str] = None
    confidence: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    confidence: str
    sources: list[SourceMemory] = []
    follow_ups: list[str] = []
    conversation_id: str
