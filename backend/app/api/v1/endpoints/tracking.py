import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.tracking_service import TrackingService
from app.schemas.tracking import (
    TrackResponse,
    TrackTimelineResponse,
    TrackingStatisticsResponse,
    RunTrackingResponse,
    TrajectoryPoint
)

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/run/{video_id}",
    response_model=RunTrackingResponse,
    status_code=status.HTTP_200_OK,
    summary="Run ByteTrack tracking on detection results"
)
def run_tracking(
    video_id: uuid.UUID,
    track_buffer: int = Query(30, description="Buffer frames for tracking loss"),
    match_threshold: float = Query(0.8, description="Tracker matching threshold"),
    score_threshold: float = Query(0.5, description="Tracker score threshold"),
    minimum_box_area: float = Query(0.0, description="Minimum bounding box area to filter out noise"),
    db: Session = Depends(get_db)
) -> RunTrackingResponse:
    """
    Consumes DetectionResult records of the video and associates them into tracks across frames.
    Saves generated Tracks to the database and links DetectionResult records to their assigned tracks.
    """
    logger.info(f"Triggering ByteTrack tracking for video {video_id} with buffer={track_buffer}, "
                f"match={match_threshold}, score={score_threshold}, min_area={minimum_box_area}")
    try:
        count = TrackingService.run_tracking(
            video_id=video_id,
            db=db,
            track_buffer=track_buffer,
            match_threshold=match_threshold,
            score_threshold=score_threshold,
            minimum_box_area=minimum_box_area
        )
        return RunTrackingResponse(
            success=True,
            message=f"Tracking completed successfully. Created {count} tracking trajectories.",
            video_id=video_id,
            tracks_count=count
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error running tracking for video {video_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tracking execution failed: {str(e)}"
        )

@router.get(
    "/results/{video_id}",
    response_model=List[TrackResponse],
    summary="Get all track results for a video"
)
def get_track_results(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> List[TrackResponse]:
    """
    Retrieve all track records (trajectories and movement metrics) generated for a video asset.
    """
    return TrackingService.get_tracks(db, video_id)

@router.get(
    "/timeline/{track_id}",
    response_model=List[TrajectoryPoint],
    summary="Get trajectory timeline points for a track"
)
def get_track_timeline(
    track_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> List[TrajectoryPoint]:
    """
    Retrieve coordinate timeline trajectory details for a specific track UUID.
    """
    return TrackingService.get_timeline(db, track_id)

@router.get(
    "/statistics/{video_id}",
    response_model=TrackingStatisticsResponse,
    summary="Get tracking analysis statistics for a video"
)
def get_tracking_statistics(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> TrackingStatisticsResponse:
    """
    Retrieve aggregated movement and tracking statistics (average speeds, duration, coverage, etc.)
    for a specific video.
    """
    stats = TrackingService.get_statistics(db, video_id)
    return TrackingStatisticsResponse(**stats)
