import logging
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, Date

from app.database.session import get_db
from app.models.video import Video
from app.models.detection_result import DetectionResult
from app.models.track import Track
from app.models.zone import Zone
from app.models.behavior_event import BehaviorEvent
from app.schemas.analytics import AnalyticsOverviewResponse, ZoneDwellTime, EventDistribution, DailyActivity

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated platform-wide operational analytics"
)
def get_analytics_overview(
    video_id: Optional[uuid.UUID] = Query(None, description="Filter statistics to a specific video asset"),
    db: Session = Depends(get_db)
) -> AnalyticsOverviewResponse:
    """
    Computes global metrics and timeline distributions across all videos,
    or filters metrics to a single video to render historical/comparative charts.
    """
    logger.info(f"Computing analytics overview. Filter video_id: {video_id}")

    # 1. Base counts
    videos_q = db.query(Video).filter(Video.deleted == False)
    if video_id:
        videos_q = videos_q.filter(Video.id == video_id)
    total_videos = videos_q.count()

    detections_q = db.query(DetectionResult)
    if video_id:
        detections_q = detections_q.filter(DetectionResult.video_id == video_id)
    total_detections = detections_q.count()

    tracks_q = db.query(Track)
    if video_id:
        tracks_q = tracks_q.filter(Track.video_id == video_id)
    total_tracks = tracks_q.count()

    events_q = db.query(BehaviorEvent)
    if video_id:
        events_q = events_q.filter(BehaviorEvent.video_id == video_id)
    total_events = events_q.count()

    alerts_q = db.query(BehaviorEvent).filter(BehaviorEvent.event_type == "Restricted Area Entry")
    if video_id:
        alerts_q = alerts_q.filter(BehaviorEvent.video_id == video_id)
    security_alerts = alerts_q.count()

    # 2. Most Visited Zone
    top_zone_q = db.query(Zone.name, func.count(BehaviorEvent.id).label('count'))\
                   .join(BehaviorEvent, BehaviorEvent.zone_id == Zone.id)\
                   .group_by(Zone.name)\
                   .order_by(func.count(BehaviorEvent.id).desc())
    if video_id:
        top_zone_q = top_zone_q.filter(Zone.video_id == video_id)
    top_zone = top_zone_q.first()
    most_visited_zone = top_zone[0] if top_zone else "None"

    # 3. Overall average dwell time (excluding generic enter/exit zones)
    dwell_q = db.query(func.avg(BehaviorEvent.duration))\
                .filter(BehaviorEvent.event_type.notin_(["Entered Zone", "Exited Zone"]))\
                .filter(BehaviorEvent.duration > 0)
    if video_id:
        dwell_q = dwell_q.filter(BehaviorEvent.video_id == video_id)
    avg_dwell = dwell_q.scalar()
    avg_dwell_time = float(avg_dwell) if avg_dwell else 0.0

    # 4. Zone Dwell Times distribution
    zone_dwells_q = db.query(Zone.name, func.avg(BehaviorEvent.duration))\
                      .join(BehaviorEvent, BehaviorEvent.zone_id == Zone.id)\
                      .filter(BehaviorEvent.event_type.notin_(["Entered Zone", "Exited Zone"]))\
                      .filter(BehaviorEvent.duration > 0)\
                      .group_by(Zone.name)\
                      .order_by(func.avg(BehaviorEvent.duration).desc())
    if video_id:
        zone_dwells_q = zone_dwells_q.filter(Zone.video_id == video_id)
    zone_dwells = zone_dwells_q.limit(10).all()
    zone_dwell_times = [
        ZoneDwellTime(zone_name=z[0], avg_dwell_seconds=round(float(z[1]), 2) if z[1] else 0.0)
        for z in zone_dwells
    ]

    # 5. Event Type distribution
    event_dist_q = db.query(BehaviorEvent.event_type, func.count(BehaviorEvent.id))\
                     .group_by(BehaviorEvent.event_type)\
                     .order_by(func.count(BehaviorEvent.id).desc())
    if video_id:
        event_dist_q = event_dist_q.filter(BehaviorEvent.video_id == video_id)
    event_dist = event_dist_q.all()
    event_distribution = [
        EventDistribution(event_type=e[0], count=e[1])
        for e in event_dist
    ]

    # 6. Daily Activity Timeline (last 10 days)
    # Align by date in python to ensure continuous chart line
    timeline_days = 10
    start_date = (datetime.utcnow() - timedelta(days=timeline_days - 1)).date()
    date_range = [start_date + timedelta(days=x) for x in range(timeline_days)]
    
    # Query databases
    det_daily_q = db.query(func.cast(DetectionResult.created_at, Date), func.count(DetectionResult.id))\
                    .filter(func.cast(DetectionResult.created_at, Date) >= start_date)\
                    .group_by(func.cast(DetectionResult.created_at, Date))
    if video_id:
        det_daily_q = det_daily_q.filter(DetectionResult.video_id == video_id)
    det_daily = dict(det_daily_q.all())

    track_daily_q = db.query(func.cast(Track.created_at, Date), func.count(Track.id))\
                      .filter(func.cast(Track.created_at, Date) >= start_date)\
                      .group_by(func.cast(Track.created_at, Date))
    if video_id:
        track_daily_q = track_daily_q.filter(Track.video_id == video_id)
    track_daily = dict(track_daily_q.all())

    evt_daily_q = db.query(func.cast(BehaviorEvent.created_at, Date), func.count(BehaviorEvent.id))\
                     .filter(func.cast(BehaviorEvent.created_at, Date) >= start_date)\
                     .group_by(func.cast(BehaviorEvent.created_at, Date))
    if video_id:
        evt_daily_q = evt_daily_q.filter(BehaviorEvent.video_id == video_id)
    evt_daily = dict(evt_daily_q.all())

    daily_activity = []
    for d in date_range:
        daily_activity.append(DailyActivity(
            date=d.isoformat(),
            detections=det_daily.get(d, 0),
            tracks=track_daily.get(d, 0),
            events=evt_daily.get(d, 0)
        ))

    # 7. Recent Logged Activity (last 10 events)
    recent_events_q = db.query(BehaviorEvent)\
                        .options(joinedload(BehaviorEvent.video), joinedload(BehaviorEvent.zone))\
                        .order_by(BehaviorEvent.created_at.desc())
    if video_id:
        recent_events_q = recent_events_q.filter(BehaviorEvent.video_id == video_id)
    recent_events = recent_events_q.limit(10).all()

    recent_activity = []
    for e in recent_events:
        recent_activity.append({
            "id": str(e.id),
            "video_id": str(e.video_id),
            "video_name": e.video.original_filename if e.video else "Unknown Video",
            "track_id": e.track_id,
            "zone_name": e.zone.name if e.zone else "Global",
            "event_type": e.event_type,
            "duration": round(e.duration, 1),
            "created_at": e.created_at.isoformat()
        })

    # 8. Advanced Analytics calculations
    try:
        from sqlalchemy import desc
        
        # Peak Hours (grouped by hour of day)
        hour_extract = func.extract('hour', BehaviorEvent.created_at)
        peak_hours_q = db.query(hour_extract.label('hour'), func.count(BehaviorEvent.id).label('count'))
        if video_id:
            peak_hours_q = peak_hours_q.filter(BehaviorEvent.video_id == video_id)
        peak_hours_raw = peak_hours_q.group_by('hour').order_by('hour').all()
        peak_hours = [{"hour": int(h[0]), "count": h[1]} for h in peak_hours_raw if h[0] is not None]
    except Exception as ex:
        logger.error(f"Failed to calculate peak hours: {str(ex)}")
        peak_hours = []

    try:
        # Entry vs Exit counts
        entry_q = db.query(func.count(BehaviorEvent.id)).filter(BehaviorEvent.event_type == "Entering")
        exit_q = db.query(func.count(BehaviorEvent.id)).filter(BehaviorEvent.event_type == "Exiting")
        if video_id:
            entry_q = entry_q.filter(BehaviorEvent.video_id == video_id)
            exit_q = exit_q.filter(BehaviorEvent.video_id == video_id)
        entries = entry_q.scalar() or 0
        exits = exit_q.scalar() or 0
        entry_exit_counts = {"entries": entries, "exits": exits}
    except Exception as ex:
        logger.error(f"Failed to calculate entry/exits: {str(ex)}")
        entry_exit_counts = {"entries": 0, "exits": 0}

    try:
        # Top Revisited Areas (Repeated Visits grouped by zone)
        revisit_q = db.query(Zone.name, func.count(BehaviorEvent.id).label('count'))\
                      .join(BehaviorEvent, BehaviorEvent.zone_id == Zone.id)\
                      .filter(BehaviorEvent.event_type == "Repeated Visits")\
                      .group_by(Zone.name)\
                      .order_by(func.count(BehaviorEvent.id).desc())
        if video_id:
            revisit_q = revisit_q.filter(Zone.video_id == video_id)
        revisits_raw = revisit_q.limit(5).all()
        top_revisited_areas = [{"zone_name": r[0], "count": r[1]} for r in revisits_raw]
    except Exception as ex:
        logger.error(f"Failed to calculate top revisited areas: {str(ex)}")
        top_revisited_areas = []

    return AnalyticsOverviewResponse(
        total_videos=total_videos,
        total_detections=total_detections,
        total_tracks=total_tracks,
        total_events=total_events,
        security_alerts=security_alerts,
        most_visited_zone=most_visited_zone,
        avg_dwell_time=round(avg_dwell_time, 1),
        zone_dwell_times=zone_dwell_times,
        event_distribution=event_distribution,
        daily_activity=daily_activity,
        recent_activity=recent_activity,
        peak_hours=peak_hours,
        entry_exit_counts=entry_exit_counts,
        top_revisited_areas=top_revisited_areas
    )

