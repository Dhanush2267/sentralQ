import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class DetectionResult(Base):
    __tablename__ = "detection_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    processing_job_id = Column(UUID(as_uuid=True), ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    frame_number = Column(Integer, nullable=False)
    timestamp_seconds = Column(Float, nullable=False)
    class_name = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    bbox_x = Column(Float, nullable=False)
    bbox_y = Column(Float, nullable=False)
    bbox_width = Column(Float, nullable=False)
    bbox_height = Column(Float, nullable=False)
    model_name = Column(String, nullable=False)
    model_version = Column(String, nullable=False)
    track_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    processing_job = relationship("ProcessingJob", foreign_keys=[processing_job_id])
    video = relationship("Video", foreign_keys=[video_id])

    __table_args__ = (
        Index("ix_detection_results_processing_job_id", "processing_job_id"),
        Index("ix_detection_results_video_id", "video_id"),
        Index("ix_detection_results_frame_number", "frame_number"),
        Index("ix_detection_results_class_name", "class_name"),
        Index("ix_detection_results_track_id", "track_id"),
    )
