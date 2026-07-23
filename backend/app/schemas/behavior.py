import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.zones import ZoneResponse

class BehaviorEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    track_id: int
    zone_id: Optional[uuid.UUID] = None
    event_type: str
    start_frame: int
    end_frame: int
    start_timestamp: float
    end_timestamp: float
    duration: float
    confidence: float
    metadata_json: Dict[str, Any]
    
    # Explainability & Rich Index fields
    summary: Optional[str] = None
    search_text: Optional[str] = None
    reason: Optional[str] = None
    threshold: Optional[float] = None

    created_at: datetime
    zone: Optional[ZoneResponse] = None


class BehaviorStatisticsResponse(BaseModel):
    total_events: int
    loitering_count: int
    security_alerts_count: int
    event_type_counts: Dict[str, int]
    top_visited_zones: List[Dict[str, Any]]
    average_dwell_times: List[Dict[str, Any]]
    # Timeline is included by the repository — must be accepted by the schema
    timeline: List[Dict[str, Any]] = []

class RunBehaviorResponse(BaseModel):
    success: bool
    message: str
    video_id: uuid.UUID
    events_count: int

