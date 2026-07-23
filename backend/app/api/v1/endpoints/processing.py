import uuid
from fastapi import APIRouter, Depends, BackgroundTasks, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.processing_service import ProcessingService
from app.schemas.processing import ProcessingJobResponse

router = APIRouter()

@router.post(
    "/start/{video_id}",
    response_model=ProcessingJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start vision processing for a video"
)
def start_processing(
    video_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start vision processing (frame extraction & placeholder inference) for an uploaded video.
    """
    return ProcessingService.start_processing(video_id, db, background_tasks)

@router.get(
    "/status/{video_id}",
    response_model=ProcessingJobResponse,
    summary="Get vision processing status for a video"
)
def get_status(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    Get progress, stage, timings, and frames count of the latest vision processing job for a video.
    """
    return ProcessingService.get_status(video_id, db)

@router.post(
    "/retry/{video_id}",
    response_model=ProcessingJobResponse,
    summary="Retry a failed vision processing job"
)
def retry_processing(
    video_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Reset progress and restart processing for a failed vision processing job.
    """
    return ProcessingService.retry_processing(video_id, db, background_tasks)

@router.delete(
    "/cancel/{video_id}",
    response_model=ProcessingJobResponse,
    summary="Cancel active vision processing for a video"
)
def cancel_processing(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    Cancel an active (queued/processing) vision job.
    """
    return ProcessingService.cancel_processing(video_id, db)
