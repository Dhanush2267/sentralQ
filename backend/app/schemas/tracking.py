import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, ConfigDict

class TrajectoryPoint(BaseModel):
    frame_number: int
    center_x: float
    center_y: float
    timestamp: float

class TrackBase(BaseModel):
    video_id: uuid.UUID
    processing_job_id: uuid.UUID
    track_id: int
    class_name: str
    first_frame: int
    last_frame: int
    first_seen_timestamp: float
    last_seen_timestamp: float
    total_frames: int
    average_confidence: float
    current_status: str
    distance_travelled: float
    average_speed: float
    track_duration: float
    frame_coverage: float
    trajectory: List[TrajectoryPoint]

class TrackCreate(TrackBase):
    pass

class TrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    processing_job_id: uuid.UUID
    track_id: int
    class_name: str
    first_frame: int
    last_frame: int
    first_seen_timestamp: float
    last_seen_timestamp: float
    total_frames: int
    average_confidence: float
    current_status: str
    distance_travelled: float
    average_speed: float
    track_duration: float
    frame_coverage: float
    trajectory: List[TrajectoryPoint]
    created_at: datetime
    updated_at: datetime

class TrackTimelineResponse(BaseModel):
    track_id: int
    class_name: str
    trajectory: List[TrajectoryPoint]

class TrackingStatisticsResponse(BaseModel):
    total_tracked_people: int
    average_tracking_duration: float
    longest_track_duration: float
    shortest_track_duration: float
    average_movement_distance: float
    track_loss_count: int
    total_tracks: int
    active_tracks: int
    completed_tracks: int
    average_track_length_frames: float

class RunTrackingResponse(BaseModel):
    success: bool
    message: str
    video_id: uuid.UUID
    tracks_count: int
