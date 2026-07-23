import uuid
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict

class DetectionResultBase(BaseModel):
    video_id: uuid.UUID
    processing_job_id: uuid.UUID
    frame_number: int
    timestamp_seconds: float
    class_name: str
    confidence: float
    bbox_x: float
    bbox_y: float
    bbox_width: float
    bbox_height: float
    model_name: str
    model_version: str

class DetectionResultCreate(DetectionResultBase):
    pass

class DetectionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    processing_job_id: uuid.UUID
    frame_number: int
    timestamp_seconds: float
    class_name: str
    confidence: float
    bbox_x: float
    bbox_y: float
    bbox_width: float
    bbox_height: float
    model_name: str
    model_version: str
    created_at: datetime

class DetectionStatisticsResponse(BaseModel):
    people: int
    bags: int
    phones: int
    bottles: int
    chairs: int
    cups: int
    others: Dict[str, int]
    total_detections: int

class RunDetectionResponse(BaseModel):
    success: bool
    message: str
    video_id: uuid.UUID
    detections_count: int
