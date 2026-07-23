import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.zone import Zone

class ZoneRepository:
    @staticmethod
    def create(db: Session, *, obj_in: dict) -> Zone:
        """
        Create a new Zone record.
        """
        db_obj = Zone(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def get(db: Session, id: uuid.UUID) -> Optional[Zone]:
        """
        Fetch a Zone by its UUID.
        """
        return db.query(Zone).filter(Zone.id == id).first()

    @staticmethod
    def get_by_video_id(db: Session, video_id: uuid.UUID) -> List[Zone]:
        """
        Get all monitoring zones configured for a specific video.
        """
        return db.query(Zone).filter(Zone.video_id == video_id).order_by(Zone.created_at.asc()).all()

    @staticmethod
    def update(db: Session, *, db_obj: Zone, obj_in: dict) -> Zone:
        """
        Update Zone properties (points, color, name, type, description).
        """
        for field in obj_in:
            if hasattr(db_obj, field):
                setattr(db_obj, field, obj_in[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def delete(db: Session, id: uuid.UUID) -> bool:
        """
        Delete a Zone.
        """
        db_obj = db.query(Zone).filter(Zone.id == id).first()
        if not db_obj:
            return False
        db.delete(db_obj)
        db.commit()
        return True
