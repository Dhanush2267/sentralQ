from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.config import settings
from app.schemas.system import SystemInfoResponse, PlatformStatsResponse, SystemDetailsResponse

from app.database.session import get_db
from app.models.video import Video
from app.models.detection_result import DetectionResult
from app.models.track import Track
from app.models.behavior_event import BehaviorEvent

router = APIRouter()


@router.get("/info", response_model=SystemInfoResponse)
def get_system_info() -> SystemInfoResponse:
    """
    Returns general details about the deployment (application name, version, environment).
    """
    return SystemInfoResponse(
        application_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT
    )


@router.get("/stats", response_model=PlatformStatsResponse, summary="Get global platform statistics")
def get_platform_stats(db: Session = Depends(get_db)) -> PlatformStatsResponse:
    """
    Returns aggregate platform metrics for the operations dashboard.
    Covers total videos, processing counts, detections, tracks, and alerts.
    """
    total_videos = db.query(func.count(Video.id)).filter(Video.deleted == False).scalar() or 0
    processing_videos = db.query(func.count(Video.id)).filter(
        Video.deleted == False,
        Video.status == "processing"
    ).scalar() or 0
    total_detections = db.query(func.count(DetectionResult.id)).scalar() or 0
    total_tracks = db.query(func.count(Track.id)).scalar() or 0
    total_behavior_events = db.query(func.count(BehaviorEvent.id)).scalar() or 0
    security_alerts = db.query(func.count(BehaviorEvent.id)).filter(
        BehaviorEvent.event_type == "Restricted Area Entry"
    ).scalar() or 0

    return PlatformStatsResponse(
        total_videos=total_videos,
        processing_videos=processing_videos,
        total_detections=total_detections,
        total_tracks=total_tracks,
        total_behavior_events=total_behavior_events,
        security_alerts=security_alerts,
    )


@router.get("/health/details", response_model=SystemDetailsResponse, summary="Get comprehensive health details")
def get_detailed_health(db: Session = Depends(get_db)) -> SystemDetailsResponse:
    """
    Performs host disk check, verifies DB connection state, and masks sensitive database URLs.
    """
    import shutil
    from sqlalchemy import text
    from app.schemas.system import SystemDetailsResponse

    # Check DB
    db_status = "Connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "Disconnected"

    # Disk space of root folder
    try:
        total, used, free = shutil.disk_usage(".")
    except Exception:
        total, used, free = 0, 0, 0

    # Hide sensitive DB password from URL
    db_url = settings.DATABASE_URL
    if "@" in db_url:
        try:
            prefix, suffix = db_url.split("@", 1)
            if "://" in prefix:
                proto, credentials = prefix.split("://", 1)
                user = credentials.split(":", 1)[0] if ":" in credentials else credentials
                db_url = f"{proto}://{user}:***@{suffix}"
        except Exception:
            pass

    return SystemDetailsResponse(
        database_status=db_status,
        database_url=db_url,
        storage_used_bytes=used,
        storage_total_bytes=total,
        storage_free_bytes=free,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT
    )


