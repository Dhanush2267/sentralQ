import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class Zone(Base):
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    zone_type = Column(String, nullable=False)  # Entry, Exit, Shelf, Checkout, Queue, Restricted, Custom
    polygon_points = Column(JSON, nullable=False)  # [[x1, y1], [x2, y2], [x3, y3], ...]
    color = Column(String, nullable=False, default="#3b82f6")  # default hex color
    description = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    video = relationship("Video", foreign_keys=[video_id])

    __table_args__ = (
        Index("ix_zones_video_id", "video_id"),
        Index("ix_zones_zone_type", "zone_type"),
    )
