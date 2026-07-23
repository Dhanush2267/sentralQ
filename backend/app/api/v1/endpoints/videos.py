import os
import uuid
import logging
from typing import Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Query,
    UploadFile,
    File,
    BackgroundTasks,
    Request
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.config import settings
from app.schemas.video import (
    UploadResponse,
    VideoDetailsResponse,
    VideoListResponse
)
from app.services.video_upload_service import VideoUploadService
from app.services.video_query_service import VideoQueryService
from app.repositories.video_repository import VideoRepository
from app.services.video_storage_service import VideoStorageService
from app.services.video_annotation_service import VideoAnnotationService




logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a video file",
    description="Uploads a video (max 2GB, mp4/avi/mov/mkv/webm) and schedules metadata & thumbnail extraction in the background."
)
def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> UploadResponse:
    logger.info(f"Upload started for file: {file.filename}")
    
    try:
        db_video = VideoUploadService.upload_video(file, db, background_tasks)
        logger.info(f"Upload completed successfully for file: {file.filename}, assigned ID: {db_video.id}")
        return UploadResponse(
            id=db_video.id,
            filename=db_video.filename,
            status="uploaded"
        )
    except HTTPException as he:
        # Re-raise known HTTP exceptions
        raise he
    except Exception as e:
        logger.error(f"Unexpected error during upload of '{file.filename}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@router.get(
    "",
    response_model=VideoListResponse,
    summary="List uploaded videos",
    description="Retrieve a paginated, sorted, and filtered list of active (non-deleted) videos."
)
def list_videos(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Page size"),
    search: Optional[str] = Query(None, description="Search term matching filename or original name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (uploaded, processing, completed, failed)"),
    sort_by: str = Query("upload_time", description="Column to sort by"),
    sort_order: str = Query("desc", description="Sort direction (asc, desc)"),
    db: Session = Depends(get_db)
) -> VideoListResponse:
    items, total, current_page, pages = VideoQueryService.list_videos(
        db,
        page=page,
        size=size,
        search=search,
        status_filter=status_filter,
        sort_by=sort_by,
        sort_order=sort_order
    )
    return VideoListResponse(
        items=items,
        total=total,
        page=current_page,
        size=size,
        pages=pages
    )


@router.get(
    "/{id}",
    response_model=VideoDetailsResponse,
    summary="Get video details",
    description="Get complete technical metadata, processing status, and storage locations for a specific video."
)
def get_video_details(
    id: uuid.UUID,
    db: Session = Depends(get_db)
) -> VideoDetailsResponse:
    return VideoQueryService.get_video_details(db, id)


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a video asset",
    description="Performs a complete hard delete of the video and cleans up all related physical storage."
)
def delete_video(
    id: uuid.UUID,
    db: Session = Depends(get_db)
):
    logger.info(f"Deletion request received for video ID: {id}")
    video = VideoRepository.get(db, id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video asset {id} not found."
        )

    # 1. Clean up physical storage files
    # Clean original video path
    VideoStorageService.delete_file(video.file_path)
    # Clean thumbnail path
    if video.thumbnail_path:
        VideoStorageService.delete_file(video.thumbnail_path)
    # Clean extracted frames directory: storage/frames/<id>
    frames_dir = os.path.join(settings.STORAGE_DIR, "frames", str(id))
    VideoStorageService.delete_directory(frames_dir)
    # Clean detections directory: storage/detections/<id>
    detections_dir = os.path.join(settings.STORAGE_DIR, "detections", str(id))
    VideoStorageService.delete_directory(detections_dir)

    # 2. Perform DB hard delete (foreign keys with ON DELETE CASCADE purge child rows)
    VideoRepository.delete(db, db_obj=video)
    logger.info(f"Database hard delete executed for video ID: {id}")

    return {
        "success": True,
        "message": "Video and all associated tracking data deleted successfully.",
        "physical_deleted": True
    }



@router.get(
    "/{id}/download",
    summary="Download video file",
    description="Download the original video file directly."
)
def download_video(
    id: uuid.UUID,
    db: Session = Depends(get_db)
) -> FileResponse:
    video = VideoRepository.get(db, id) # Use VideoRepository directly
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video asset not found."
        )
    
    if not os.path.exists(video.file_path):
        logger.error(f"Download request failed: physical file not found at '{video.file_path}'")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical video file does not exist on disk."
        )

    logger.info(f"Downloading video: {video.original_filename} (ID: {video.id})")
    return FileResponse(
        path=video.file_path,
        filename=video.original_filename,
        media_type="application/octet-stream"
    )


@router.get(
    "/{id}/download/annotated",
    summary="Download annotated video file",
    description="Compiles and downloads the annotated video showing bounding boxes, track IDs, zone transparency overlays, active incidents, and HUD timelines."
)
def download_annotated_video(
    id: uuid.UUID,
    db: Session = Depends(get_db)
) -> FileResponse:
    logger.info(f"Received download request for annotated video ID: {id}")
    video = VideoRepository.get(db, id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video asset {id} not found."
        )

    try:
        annotated_path = VideoAnnotationService.compile_annotated_video(db, id)
    except Exception as e:
        logger.error(f"Failed to compile annotated video: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Surveillance compiler error: {str(e)}"
        )

    filename = f"annotated_{video.original_filename}"
    return FileResponse(
        path=annotated_path,
        filename=filename,
        media_type="video/mp4"
    )



@router.get(
    "/{id}/stream",
    summary="Stream video content",
    description="Streams video content supporting Range requests for seekability in web browsers."
)
def stream_video(
    id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    video = VideoQueryService.get_video_details(db, id)
    
    if not os.path.exists(video.file_path):
        logger.error(f"Streaming request failed: file not found at '{video.file_path}'")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file does not exist on disk."
        )

    logger.info(f"Streaming request received for video ID: {id} (Filename: {video.filename})")

    file_path = video.file_path
    file_size = os.path.getsize(file_path)
    
    # Check for Range header
    range_header = request.headers.get("Range")
    
    # Map Content-Type based on extension for browser playing compatibility
    ext = os.path.splitext(file_path)[1].lower()
    media_type = "video/mp4"
    if ext == ".webm":
        media_type = "video/webm"
    elif ext == ".mkv":
        media_type = "video/x-matroska"
    elif ext == ".avi":
        media_type = "video/x-msvideo"
    elif ext == ".mov":
        media_type = "video/quicktime"

    if not range_header:
        # Standard full download response if Range is not requested
        logger.debug(f"Serving full video stream (no range requested) for ID: {id}")
        return FileResponse(path=file_path, media_type=media_type)

    try:
        # Parse range header: e.g. "bytes=0-1048576"
        range_val = range_header.replace("bytes=", "").strip()
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        
        # Guard limits
        if start >= file_size or end >= file_size or start > end:
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail=f"Requested range {range_header} is not satisfiable for size {file_size}."
            )
            
        chunk_size = end - start + 1
        logger.debug(f"Serving range bytes {start}-{end}/{file_size} for ID: {id}")

        def file_iterator():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    # Read in 64KB blocks
                    to_read = min(65536, remaining)
                    data = f.read(to_read)
                    if not data:
                        break
                    yield data
                    remaining -= len(data)

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
        }

        return StreamingResponse(
            file_iterator(),
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            media_type=media_type,
            headers=headers
        )
    except ValueError as ve:
        logger.warning(f"Malformed range header: {range_header}. Defaulting to full file response. Error: {str(ve)}")
        return FileResponse(path=file_path, media_type=media_type)


@router.get(
    "/{id}/thumbnail",
    summary="Get video thumbnail",
    description="Retrieve the generated thumbnail for the video."
)
def get_video_thumbnail(
    id: uuid.UUID,
    db: Session = Depends(get_db)
) -> FileResponse:
    video = VideoQueryService.get_video_details(db, id)
    
    if not video.thumbnail_path or not os.path.exists(video.thumbnail_path):
        # Fallback to standard placeholder or 404
        logger.warning(f"Thumbnail not found on disk for ID: {id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnail image does not exist."
        )

    return FileResponse(
        path=video.thumbnail_path,
        media_type="image/jpeg"
    )
