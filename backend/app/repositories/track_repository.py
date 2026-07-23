import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from app.models.track import Track

class TrackRepository:
    @staticmethod
    def create_many(db: Session, *, objs_in: List[dict]) -> List[Track]:
        """
        Bulk insert tracks.
        """
        db_objs = [Track(**obj) for obj in objs_in]
        db.bulk_save_objects(db_objs)
        db.commit()
        return db_objs

    @staticmethod
    def get(db: Session, id: uuid.UUID) -> Optional[Track]:
        """
        Fetch a single Track by its unique UUID.
        """
        return db.query(Track).filter(Track.id == id).first()

    @staticmethod
    def get_by_video_id(db: Session, video_id: uuid.UUID) -> List[Track]:
        """
        Retrieve all tracks for a specific video asset.
        """
        return db.query(Track).filter(Track.video_id == video_id).order_by(asc(Track.track_id)).all()

    @staticmethod
    def get_by_track_id(db: Session, video_id: uuid.UUID, track_id: int) -> Optional[Track]:
        """
        Retrieve a Track by its assigned integer track_id and video_id.
        """
        return db.query(Track).filter(Track.video_id == video_id, Track.track_id == track_id).first()

    @staticmethod
    def get_statistics_by_video_id(db: Session, video_id: uuid.UUID) -> Dict[str, Any]:
        """
        Query and compile tracking metrics for a video asset from the tracks table.
        """
        # Global aggregates
        aggregates = db.query(
            func.count(Track.id).label("total_tracks"),
            func.avg(Track.track_duration).label("avg_duration"),
            func.max(Track.track_duration).label("max_duration"),
            func.min(Track.track_duration).label("min_duration"),
            func.avg(Track.distance_travelled).label("avg_distance"),
            func.avg(Track.total_frames).label("avg_frames")
        ).filter(Track.video_id == video_id).first()

        # Count specific class
        total_tracked_people = db.query(func.count(Track.id))\
                                 .filter(Track.video_id == video_id, Track.class_name.ilike("person"))\
                                 .scalar() or 0

        # Status counts
        active_tracks = db.query(func.count(Track.id))\
                          .filter(Track.video_id == video_id, Track.current_status == "active")\
                          .scalar() or 0

        completed_tracks = db.query(func.count(Track.id))\
                             .filter(Track.video_id == video_id, Track.current_status == "completed")\
                             .scalar() or 0

        lost_tracks = db.query(func.count(Track.id))\
                        .filter(Track.video_id == video_id, Track.current_status == "lost")\
                        .scalar() or 0

        # Extract aggregates with fallbacks if no tracks exist yet
        total_tracks = aggregates[0] or 0
        avg_duration = round(float(aggregates[1]), 2) if aggregates[1] is not None else 0.0
        max_duration = round(float(aggregates[2]), 2) if aggregates[2] is not None else 0.0
        min_duration = round(float(aggregates[3]), 2) if aggregates[3] is not None else 0.0
        avg_distance = round(float(aggregates[4]), 2) if aggregates[4] is not None else 0.0
        avg_frames = round(float(aggregates[5]), 1) if aggregates[5] is not None else 0.0

        return {
            "total_tracked_people": total_tracked_people,
            "average_tracking_duration": avg_duration,
            "longest_track_duration": max_duration,
            "shortest_track_duration": min_duration,
            "average_movement_distance": avg_distance,
            "track_loss_count": lost_tracks,
            "total_tracks": total_tracks,
            "active_tracks": active_tracks,
            "completed_tracks": completed_tracks,
            "average_track_length_frames": avg_frames
        }
