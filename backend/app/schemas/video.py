import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.processing import ProcessingJobResponse

class UploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    status: str

    model_config = ConfigDict(from_attributes=True)

class VideoDetailsResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    file_path: str
    thumbnail_path: Optional[str] = None
    file_size: int
    duration: Optional[float] = None
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    codec: Optional[str] = None
    video_format: Optional[str] = None
    status: str
    upload_time: datetime
    created_at: datetime
    updated_at: datetime
    metadata_json: Optional[Dict[str, Any]] = None
    processing_stage: str
    deleted: bool
    latest_processing_job: Optional[ProcessingJobResponse] = None

    model_config = ConfigDict(from_attributes=True)

class CreateVideoResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    status: str
    processing_stage: str

    model_config = ConfigDict(from_attributes=True)

class VideoListResponse(BaseModel):
    items: List[VideoDetailsResponse]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)
