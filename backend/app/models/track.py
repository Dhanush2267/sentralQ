import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class Track(Base):
    __tablename__ = "tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    processing_job_id = Column(UUID(as_uuid=True), ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, nullable=False)
    class_name = Column(String, nullable=False)
    
    first_frame = Column(Integer, nullable=False)
    last_frame = Column(Integer, nullable=False)
    first_seen_timestamp = Column(Float, nullable=False)
    last_seen_timestamp = Column(Float, nullable=False)
    total_frames = Column(Integer, nullable=False)
    average_confidence = Column(Float, nullable=False)
    current_status = Column(String, nullable=False, default="completed")  # e.g., active, completed, lost
    
    # Movement analysis metrics
    distance_travelled = Column(Float, nullable=False, default=0.0)
    average_speed = Column(Float, nullable=False, default=0.0)
    track_duration = Column(Float, nullable=False, default=0.0)
    frame_coverage = Column(Float, nullable=False, default=0.0)
    
    # Trajectory points list: [{"frame_number": f, "center_x": cx, "center_y": cy, "timestamp": ts}, ...]
    trajectory = Column(JSON, nullable=False, default=list)
    
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    video = relationship("Video", foreign_keys=[video_id])
    processing_job = relationship("ProcessingJob", foreign_keys=[processing_job_id])

    __table_args__ = (
        Index("ix_tracks_video_id", "video_id"),
        Index("ix_tracks_processing_job_id", "processing_job_id"),
        Index("ix_tracks_track_id", "track_id"),
        Index("ix_tracks_class_name", "class_name"),
    )
