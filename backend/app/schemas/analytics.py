from pydantic import BaseModel
from typing import List, Dict, Any

class ZoneDwellTime(BaseModel):
    zone_name: str
    avg_dwell_seconds: float

class EventDistribution(BaseModel):
    event_type: str
    count: int

class DailyActivity(BaseModel):
    date: str
    detections: int
    tracks: int
    events: int

class AnalyticsOverviewResponse(BaseModel):
    total_videos: int
    total_detections: int
    total_tracks: int
    total_events: int
    security_alerts: int
    most_visited_zone: str
    avg_dwell_time: float
    zone_dwell_times: List[ZoneDwellTime]
    event_distribution: List[EventDistribution]
    daily_activity: List[DailyActivity]
    recent_activity: List[Dict[str, Any]]
    
    # Advanced analytics extensions
    peak_hours: List[Dict[str, Any]] = []
    entry_exit_counts: Dict[str, int] = {"entries": 0, "exits": 0}
    top_revisited_areas: List[Dict[str, Any]] = []

