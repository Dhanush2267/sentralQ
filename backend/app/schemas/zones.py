import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class ZoneBase(BaseModel):
    name: str
    zone_type: str  # Entry, Exit, Shelf, Checkout, Queue, Restricted, Custom
    polygon_points: List[List[float]]
    color: str
    description: Optional[str] = None

class ZoneCreate(ZoneBase):
    video_id: uuid.UUID

class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    zone_type: Optional[str] = None
    polygon_points: Optional[List[List[float]]] = None
    color: Optional[str] = None
    description: Optional[str] = None

class ZoneResponse(ZoneBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
