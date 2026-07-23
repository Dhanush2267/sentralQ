import uuid
import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.repositories.zone_repository import ZoneRepository
from app.repositories.track_repository import TrackRepository
from app.repositories.behavior_repository import BehaviorRepository
from app.zones.engine import detect_events_for_track, detect_global_events
from app.services.tracking_service import BehaviorEngineHook

logger = logging.getLogger(__name__)

class BehaviorService:
    @staticmethod
    def run_behavior_detection(video_id: uuid.UUID, db: Session) -> int:
        """
        Evaluate behavior monitoring rules across all tracking trajectories
        and configured zones for a specific video.
        """
        logger.info(f"Running behavior rules engine on video {video_id}...")

        # 1. Fetch zones configured for the video
        zones = ZoneRepository.get_by_video_id(db, video_id)
        if not zones:
            logger.info(f"No zones configured for video {video_id}. Clearing and skipping behavior evaluation.")
            BehaviorRepository.delete_by_video_id(db, video_id)
            return 0

        # 2. Fetch tracks for the video
        tracks = TrackRepository.get_by_video_id(db, video_id)
        if not tracks:
            logger.info(f"No tracks found for video {video_id}. Storing 0 behavior events.")
            BehaviorRepository.delete_by_video_id(db, video_id)
            return 0

        # 3. Clear existing events for idempotency
        BehaviorRepository.delete_by_video_id(db, video_id)

        events_to_create = []

        # 4. Evaluate each track's trajectory paths
        for track in tracks:
            track_events = detect_events_for_track(db, track, zones)
            
            # Enrich events with video context
            for e in track_events:
                e["video_id"] = video_id
                e["track_id"] = track.track_id
                events_to_create.append(e)

        # 5. Evaluate global group/crowd events
        try:
            global_events = detect_global_events(tracks, zones)
            for e in global_events:
                e["video_id"] = video_id
                e["track_id"] = 0  # 0 indicates a global event
                events_to_create.append(e)
        except Exception as ex:
            logger.error(f"Failed to detect global behavior events: {str(ex)}")

        # 6. Bulk insert events
        if events_to_create:
            BehaviorRepository.create_many(db, objs_in=events_to_create)
            logger.info(f"Behavior Engine successfully stored {len(events_to_create)} behavior events in PostgreSQL.")
        else:
            logger.info("Behavior Engine evaluated 0 events.")

        return len(events_to_create)


    @staticmethod
    def get_events(db: Session, video_id: uuid.UUID) -> List[Any]:
        return BehaviorRepository.get_by_video_id(db, video_id)

    @staticmethod
    def get_statistics(db: Session, video_id: uuid.UUID) -> Dict[str, Any]:
        return BehaviorRepository.get_statistics_by_video_id(db, video_id)


# -------------------------------------------------------------
# Behavior Engine callback for the tracking completed hook.
# This function is registered in app.main's startup event to avoid
# duplicate registrations from module-level side effects.
# -------------------------------------------------------------
def run_behavior_on_tracking_completed(video_id: uuid.UUID, db: Session):
    logger.info(f"Auto-Trigger: Tracking completed for video {video_id}. Invoking Behavior Engine...")
    try:
        count = BehaviorService.run_behavior_detection(video_id, db)
        logger.info(f"Auto-Trigger: Behavior Engine finished. Saved {count} events.")
    except Exception as e:
        logger.error(f"Auto-Trigger: Behavior Engine execution failed: {str(e)}", exc_info=True)

# NOTE: Hook registration is done in app/main.py startup event,
# NOT here, to prevent duplicate registrations on module re-import.

