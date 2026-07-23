import uuid
from typing import Optional
from pydantic import BaseModel

class AISearchRequest(BaseModel):
    query: str
    video_id: Optional[uuid.UUID] = None

class AISearchResponse(BaseModel):
    query: str
    answer: str
    source: str
    grok_model: str
