import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="queued")  # queued, processing, completed, failed
    
    queued = Column(DateTime, nullable=True)
    processing = Column(DateTime, nullable=True)
    completed = Column(DateTime, nullable=True)
    failed = Column(DateTime, nullable=True)
    
    progress_percentage = Column(Float, nullable=False, default=0.0)
    current_stage = Column(String, nullable=False, default="queued")  # queued, frame_extraction, frame_validation, ai_ready, completed, failed
    total_frames = Column(Integer, nullable=False, default=0)
    processed_frames = Column(Integer, nullable=False, default=0)
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    video = relationship("Video", back_populates="processing_jobs")

    __table_args__ = (
        Index("ix_processing_jobs_video_id", "video_id"),
        Index("ix_processing_jobs_status", "status"),
        Index("ix_processing_jobs_created_at", "created_at"),
    )
