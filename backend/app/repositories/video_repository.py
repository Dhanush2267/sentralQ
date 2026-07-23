import uuid
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc
from app.models.video import Video

class VideoRepository:
    @staticmethod
    def create(db: Session, *, obj_in: dict) -> Video:
        """Create a new video record in the database."""
        db_obj = Video(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def get(db: Session, id: uuid.UUID, include_deleted: bool = False) -> Optional[Video]:
        """Fetch a single video by its ID."""
        query = db.query(Video).filter(Video.id == id)
        if not include_deleted:
            query = query.filter(Video.deleted == False)
        return query.first()

    @staticmethod
    def list_active(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "upload_time",
        sort_order: str = "desc"
    ) -> Tuple[List[Video], int]:
        """
        List active (non-soft-deleted) videos with filtering, search, sorting, and pagination.
        Returns a tuple of (items, total_count).
        """
        query = db.query(Video).filter(Video.deleted == False)

        # Filters
        if status:
            query = query.filter(Video.status == status)

        # Search by original filename or filename
        if search:
            query = query.filter(
                or_(
                    Video.original_filename.ilike(f"%{search}%"),
                    Video.filename.ilike(f"%{search}%")
                )
            )

        # Total count before pagination
        total = query.count()

        # Sorting
        sort_col = getattr(Video, sort_by, Video.upload_time)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

        # Pagination
        items = query.offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def update(db: Session, *, db_obj: Video, obj_in: dict) -> Video:
        """Update fields of an existing video record."""
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def soft_delete(db: Session, *, db_obj: Video) -> Video:
        """Mark video record as deleted in the database (soft delete)."""
        db_obj.deleted = True
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def delete(db: Session, *, db_obj: Video) -> None:
        """Completely delete the video record (hard delete) from the database."""
        db.delete(db_obj)
        db.commit()

