import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.models.processing_job import ProcessingJob

class ProcessingRepository:
    @staticmethod
    def create(db: Session, *, obj_in: dict) -> ProcessingJob:
        """
        Create a new ProcessingJob record.
        """
        db_obj = ProcessingJob(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def get(db: Session, id: uuid.UUID) -> Optional[ProcessingJob]:
        """
        Fetch a ProcessingJob by its unique ID.
        """
        return db.query(ProcessingJob).filter(ProcessingJob.id == id).first()

    @staticmethod
    def get_by_video_id(db: Session, video_id: uuid.UUID) -> Optional[ProcessingJob]:
        """
        Get the latest ProcessingJob for a given video ID.
        """
        return db.query(ProcessingJob)\
                 .filter(ProcessingJob.video_id == video_id)\
                 .order_by(desc(ProcessingJob.created_at))\
                 .first()

    @staticmethod
    def get_next_queued(db: Session) -> Optional[ProcessingJob]:
        """
        Get the oldest queued ProcessingJob from the database.
        """
        return db.query(ProcessingJob)\
                 .filter(ProcessingJob.status == "queued")\
                 .order_by(asc(ProcessingJob.created_at))\
                 .first()

    @staticmethod
    def update(db: Session, *, db_obj: ProcessingJob, obj_in: dict) -> ProcessingJob:
        """
        Update fields on an existing ProcessingJob.
        """
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
