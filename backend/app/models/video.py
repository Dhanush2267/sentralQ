import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, BigInteger, DateTime, JSON, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class Video(Base):
    __tablename__ = "videos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    thumbnail_path = Column(String, nullable=True)
    file_size = Column(BigInteger, nullable=False)
    duration = Column(Float, nullable=True)
    fps = Column(Float, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    codec = Column(String, nullable=True)
    video_format = Column(String, nullable=True)
    status = Column(String, nullable=False, default="uploaded")  # e.g., uploaded, processing, completed, failed
    upload_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata_json = Column(JSON, nullable=True)
    processing_stage = Column(String, nullable=False, default="upload")  # e.g., upload, metadata, thumbnail, completed, failed
    deleted = Column(Boolean, nullable=False, default=False)

    processing_jobs = relationship(
        "ProcessingJob",
        back_populates="video",
        cascade="all, delete-orphan",
        order_by="desc(ProcessingJob.created_at)"
    )

    reports = relationship(
        "Report",
        back_populates="video",
        cascade="all, delete-orphan",
        order_by="desc(Report.created_at)"
    )


    @property
    def latest_processing_job(self):
        return self.processing_jobs[0] if self.processing_jobs else None

    __table_args__ = (
        Index("ix_videos_filename", "filename"),
        Index("ix_videos_upload_time", "upload_time"),
        Index("ix_videos_status", "status"),
    )
