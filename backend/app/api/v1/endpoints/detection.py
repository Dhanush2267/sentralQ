import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.detection_service import DetectionService
from app.schemas.detection import (
    DetectionResultResponse,
    DetectionStatisticsResponse,
    RunDetectionResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/run/{video_id}",
    response_model=RunDetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Run/Re-run YOLO detection on a video's extracted frames"
)
def run_detection(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> RunDetectionResponse:
    """
    Explicitly triggers YOLO object detection on the already-extracted frames of the video asset.
    Stores results in the database and generates overlay image frames.
    """
    logger.info(f"Manual detection trigger request received for Video ID: {video_id}")
    try:
        count = DetectionService.run_detection_for_video(video_id, db)
        return RunDetectionResponse(
            success=True,
            message=f"Detection run completed successfully. Generated {count} detections.",
            video_id=video_id,
            detections_count=count
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error running detection manually for video {video_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Detection execution failed: {str(e)}"
        )

@router.get(
    "/results/{video_id}",
    response_model=List[DetectionResultResponse],
    summary="Get all detection results for a video"
)
def get_detection_results(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> List[DetectionResultResponse]:
    """
    Retrieve all detected objects (with classes, confidence scores, and bounding boxes) for a video.
    """
    return DetectionService.get_detections(db, video_id)

@router.get(
    "/frame/{video_id}/{frame_number}",
    summary="Get annotated frame image"
)
def get_annotated_frame(
    video_id: uuid.UUID,
    frame_number: int
) -> FileResponse:
    """
    Returns the annotated overlay image (JPEG) with bounding boxes and labels for the specified frame.
    If the detection overlay does not exist, falls back to returning the raw extracted frame.
    """
    frame_path = DetectionService.get_frame_path(video_id, frame_number)
    return FileResponse(path=frame_path, media_type="image/jpeg")

@router.get(
    "/statistics/{video_id}",
    response_model=DetectionStatisticsResponse,
    summary="Get class statistics for a video"
)
def get_detection_statistics(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> DetectionStatisticsResponse:
    """
    Fetch the aggregated count of detected objects by major classes:
    People, Bags, Phones, Bottles, Chairs, Cups, and Others.
    """
    stats = DetectionService.get_statistics(db, video_id)
    return DetectionStatisticsResponse(**stats)
