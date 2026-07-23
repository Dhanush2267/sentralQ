import uuid
import logging
from typing import List, Dict, Any, Optional
from collections import defaultdict
from sqlalchemy import asc
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.repositories.video_repository import VideoRepository
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.track_repository import TrackRepository
from app.models.detection_result import DetectionResult
from app.models.track import Track
from app.tracking.bytetrack_engine import ByteTrackEngine
from app.tracking.tracker import ByteTrackTracker
from app.tracking.movement import calculate_movement_metrics

logger = logging.getLogger(__name__)

# Phase 6 Behavior Intelligence Extension Point
class BehaviorEngineHook:
    _listeners = []

    @classmethod
    def register_listener(cls, callback):
        """
        Register a behavior analysis callback function.
        """
        cls._listeners.append(callback)
        logger.info(f"Registered behavior engine callback: {callback.__name__}")

    @classmethod
    def trigger_behavior_analysis(cls, video_id: uuid.UUID, db: Session):
        """
        Notify all listeners that tracking data is now ready.
        Future hooks can evaluate: Entered Area, Exited Area, Stopped, Picked/Returned Item, etc.
        """
        logger.info(f"Triggering behavior engine callbacks for video {video_id} (active listeners: {len(cls._listeners)})")
        for callback in cls._listeners:
            try:
                callback(video_id, db)
            except Exception as e:
                logger.error(f"Error executing behavior engine callback: {str(e)}", exc_info=True)

class TrackingService:
    @staticmethod
    def run_tracking(
        video_id: uuid.UUID,
        db: Session,
        track_buffer: int = 30,
        match_threshold: float = 0.8,
        score_threshold: float = 0.5,
        minimum_box_area: float = 0.0
    ) -> int:
        """
        Query all detection results of a video, run ByteTrack association,
        calculate movement analytics, and save generated Tracks.
        """
        # 1. Validate video exists
        video = VideoRepository.get(db, video_id)
        if not video:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Video asset with ID {video_id} not found."
            )

        # 2. Get processing job
        job = ProcessingRepository.get_by_video_id(db, video_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No vision processing job exists for video ID {video_id}."
            )

        total_video_frames = job.total_frames or 1

        # 3. Retrieve all detections sorted by frame number
        detections = db.query(DetectionResult)\
                       .filter(DetectionResult.video_id == video_id)\
                       .order_by(asc(DetectionResult.frame_number))\
                       .all()

        if not detections:
            logger.info(f"No detections found for video {video_id}. Storing 0 tracks.")
            # Clear existing tracks if any
            db.query(Track).filter(Track.video_id == video_id).delete()
            db.commit()
            return 0

        # Group detections by frame number
        dets_by_frame = defaultdict(list)
        for det in detections:
            dets_by_frame[det.frame_number].append(det)

        # 4. Instantiate ByteTrack Engine
        engine = ByteTrackEngine(
            track_buffer=track_buffer,
            match_threshold=match_threshold,
            score_threshold=score_threshold,
            minimum_box_area=minimum_box_area
        )
        tracker = ByteTrackTracker(engine)

        # 5. Run tracking association
        tracks_data = tracker.track_detections(dets_by_frame, total_video_frames)

        # 6. Clear existing tracking data for this video (idempotency on re-run)
        db.query(Track).filter(Track.video_id == video_id).delete()
        db.query(DetectionResult).filter(DetectionResult.video_id == video_id).update({"track_id": None})
        db.commit()

        # 7. Format and compile tracks
        tracks_to_create = []
        for track_id, track_dets in tracks_data.items():
            if not track_dets:
                continue

            # Sort detections by frame number
            track_dets.sort(key=lambda x: x["frame_number"])
            first_det = track_dets[0]
            last_det = track_dets[-1]

            # Generate trajectory points list
            trajectory_points = []
            for d in track_dets:
                trajectory_points.append({
                    "frame_number": d["frame_number"],
                    "center_x": round(d["center_x"], 2),
                    "center_y": round(d["center_y"], 2),
                    "timestamp": round(d["timestamp"], 2)
                })

            # Calculate movement metrics
            total_tracked_frames = len(track_dets)
            metrics = calculate_movement_metrics(
                trajectory=trajectory_points,
                total_tracked_frames=total_tracked_frames,
                total_video_frames=total_video_frames
            )

            # Average confidence
            avg_conf = sum(d["confidence"] for d in track_dets) / total_tracked_frames

            track_obj = {
                "video_id": video_id,
                "processing_job_id": job.id,
                "track_id": track_id,
                "class_name": first_det["class_name"],
                "first_frame": first_det["frame_number"],
                "last_frame": last_det["frame_number"],
                "first_seen_timestamp": first_det["timestamp"],
                "last_seen_timestamp": last_det["timestamp"],
                "total_frames": total_tracked_frames,
                "average_confidence": round(avg_conf, 4),
                "current_status": "completed",
                "distance_travelled": metrics["distance_travelled"],
                "average_speed": metrics["average_speed"],
                "track_duration": metrics["track_duration"],
                "frame_coverage": metrics["frame_coverage"],
                "trajectory": trajectory_points
            }
            tracks_to_create.append(track_obj)

        if tracks_to_create:
            # Save tracks to DB
            TrackRepository.create_many(db, objs_in=tracks_to_create)

            # Link detection results in DB to their track ID
            for track_id, track_dets in tracks_data.items():
                det_ids = [d["detection_id"] for d in track_dets]
                db.query(DetectionResult)\
                  .filter(DetectionResult.id.in_(det_ids))\
                  .update({"track_id": track_id}, synchronize_session=False)
            db.commit()

        # 8. Trigger hook for Phase 6 Behavior Engine
        BehaviorEngineHook.trigger_behavior_analysis(video_id, db)

        return len(tracks_to_create)

    @staticmethod
    def get_tracks(db: Session, video_id: uuid.UUID) -> List[Track]:
        return TrackRepository.get_by_video_id(db, video_id)

    @staticmethod
    def get_timeline(db: Session, track_uuid: uuid.UUID) -> List[Dict[str, Any]]:
        track = TrackRepository.get(db, track_uuid)
        if not track:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Track record {track_uuid} not found."
            )
        return track.trajectory

    @staticmethod
    def get_statistics(db: Session, video_id: uuid.UUID) -> Dict[str, Any]:
        return TrackRepository.get_statistics_by_video_id(db, video_id)
