import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class ReportBase(BaseModel):
    video_id: uuid.UUID
    report_type: str
    format: str

class ReportCreate(ReportBase):
    pass

class ReportResponse(ReportBase):
    id: uuid.UUID
    filename: str
    status: str
    created_at: datetime
    video_name: Optional[str] = None

    class Config:
        from_attributes = True
