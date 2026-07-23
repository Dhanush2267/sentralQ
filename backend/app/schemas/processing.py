import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class ProcessingJobBase(BaseModel):
    video_id: uuid.UUID

class ProcessingJobCreate(ProcessingJobBase):
    pass

class ProcessingJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    status: str
    
    queued: Optional[datetime] = None
    processing: Optional[datetime] = None
    completed: Optional[datetime] = None
    failed: Optional[datetime] = None
    
    progress_percentage: float
    current_stage: str
    total_frames: int
    processed_frames: int
    
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime
