import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class BehaviorEvent(Base):
    __tablename__ = "behavior_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, nullable=False)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id", ondelete="CASCADE"), nullable=True)
    event_type = Column(String, nullable=False)  # e.g., Entered Zone, Exited Zone, Loitering, etc.
    
    start_frame = Column(Integer, nullable=False)
    end_frame = Column(Integer, nullable=False)
    start_timestamp = Column(Float, nullable=False)
    end_timestamp = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False, default=1.0)
    metadata_json = Column(JSON, nullable=False, default=dict)
    
    # Explainability & Rich Indexing fields
    summary = Column(String, nullable=True)
    search_text = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    threshold = Column(Float, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


    # Relationships
    video = relationship("Video", foreign_keys=[video_id])
    zone = relationship("Zone", foreign_keys=[zone_id])

    __table_args__ = (
        Index("ix_behavior_events_video_id", "video_id"),
        Index("ix_behavior_events_track_id", "track_id"),
        Index("ix_behavior_events_zone_id", "zone_id"),
        Index("ix_behavior_events_event_type", "event_type"),
    )
