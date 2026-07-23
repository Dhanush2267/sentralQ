import uuid
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.video import Video
from app.repositories.video_repository import VideoRepository

class VideoQueryService:
    @staticmethod
    def get_video_details(db: Session, video_id: uuid.UUID) -> Video:
        """
        Retrieve a single active video record by ID.
        Raises 404 if not found or soft-deleted.
        """
        video = VideoRepository.get(db, video_id, include_deleted=False)
        if not video:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Video with ID '{video_id}' not found."
            )
        return video

    @staticmethod
    def list_videos(
        db: Session,
        *,
        page: int = 1,
        size: int = 10,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        sort_by: str = "upload_time",
        sort_order: str = "desc"
    ) -> Tuple[List[Video], int, int, int]:
        """
        List active videos with pagination, search filter, and sorting.
        Returns a tuple of (items, total_count, current_page, page_size).
        """
        # Ensure page and size are sensible positive numbers
        if page < 1:
            page = 1
        if size < 1:
            size = 10
            
        skip = (page - 1) * size

        # Map sorting parameter safely to avoid column injections
        allowed_sort_cols = {"upload_time", "filename", "file_size", "duration"}
        if sort_by not in allowed_sort_cols:
            sort_by = "upload_time"

        if sort_order.lower() not in {"asc", "desc"}:
            sort_order = "desc"

        items, total = VideoRepository.list_active(
            db,
            skip=skip,
            limit=size,
            search=search,
            status=status_filter,
            sort_by=sort_by,
            sort_order=sort_order
        )

        # Calculate pages count
        pages = (total + size - 1) // size if size > 0 else 0

        return items, total, page, pages
