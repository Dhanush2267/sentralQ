import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.behavior_service import BehaviorService
from app.schemas.behavior import BehaviorEventResponse, BehaviorStatisticsResponse, RunBehaviorResponse

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/run/{video_id}",
    response_model=RunBehaviorResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger behavior analysis rules engine"
)
def run_behavior_analysis(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> RunBehaviorResponse:
    """
    Evaluate zone crossing, loitering, wrong direction, and restricted entry rules
    based on PostgreSQL tracked trajectories and zone points.
    """
    logger.info(f"Triggering behavior rules engine for video {video_id}...")
    try:
        count = BehaviorService.run_behavior_detection(video_id, db)
        return RunBehaviorResponse(
            success=True,
            message=f"Behavior rules engine executed successfully. Logged {count} behavior events.",
            video_id=video_id,
            events_count=count
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Behavior analysis failed for video {video_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Behavior analysis failed: {str(e)}"
        )

@router.get(
    "/results/{video_id}",
    response_model=List[BehaviorEventResponse],
    summary="Get behavior events logged for a video"
)
def get_behavior_results(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> List[BehaviorEventResponse]:
    """
    Retrieve all behavior events logs generated for a video asset.
    """
    return BehaviorService.get_events(db, video_id)

@router.get(
    "/statistics/{video_id}",
    response_model=BehaviorStatisticsResponse,
    summary="Get aggregated behavior metrics for dashboard widgets"
)
def get_behavior_statistics(
    video_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> BehaviorStatisticsResponse:
    """
    Retrieve statistics aggregates (loitering times, restricted entries, peak zones)
    suitable for plotting analytics charts.
    """
    stats = BehaviorService.get_statistics(db, video_id)
    return BehaviorStatisticsResponse(**stats)
