import uuid
from typing import List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, asc
from app.models.behavior_event import BehaviorEvent
from app.models.zone import Zone

class BehaviorRepository:
    @staticmethod
    def create_many(db: Session, *, objs_in: List[dict]) -> List[BehaviorEvent]:
        """
        Bulk insert behavior events.
        """
        db_objs = [BehaviorEvent(**obj) for obj in objs_in]
        db.bulk_save_objects(db_objs)
        db.commit()
        return db_objs

    @staticmethod
    def get_by_video_id(db: Session, video_id: uuid.UUID) -> List[BehaviorEvent]:
        """
        Retrieve all behavior events for a video sorted by time.
        Uses joinedload to avoid N+1 queries on the zone relationship.
        """
        return db.query(BehaviorEvent)\
                 .options(joinedload(BehaviorEvent.zone))\
                 .filter(BehaviorEvent.video_id == video_id)\
                 .order_by(asc(BehaviorEvent.start_timestamp))\
                 .all()

    @staticmethod
    def delete_by_video_id(db: Session, video_id: uuid.UUID) -> None:
        """
        Delete all behavior events for a video (idempotency support).
        """
        db.query(BehaviorEvent).filter(BehaviorEvent.video_id == video_id).delete()
        db.commit()

    @staticmethod
    def get_statistics_by_video_id(db: Session, video_id: uuid.UUID) -> Dict[str, Any]:
        """
        Compile analytics summary metrics from PostgreSQL for the video dashboard.
        """
        # 1. Event counts grouped by event_type
        counts_q = db.query(
            BehaviorEvent.event_type,
            func.count(BehaviorEvent.id)
        ).filter(BehaviorEvent.video_id == video_id)\
         .group_by(BehaviorEvent.event_type).all()
        
        event_counts = {item[0]: item[1] for item in counts_q}

        # 2. Top visited zones (Entered Zone counts)
        top_zones_q = db.query(
            Zone.name,
            func.count(BehaviorEvent.id)
        ).select_from(BehaviorEvent)\
         .join(Zone, BehaviorEvent.zone_id == Zone.id)\
         .filter(BehaviorEvent.video_id == video_id, BehaviorEvent.event_type == "Entered Zone")\
         .group_by(Zone.name)\
         .order_by(desc(func.count(BehaviorEvent.id)))\
         .limit(5).all()

        top_visited_zones = [{"zone_name": item[0], "count": item[1]} for item in top_zones_q]

        # 3. Average dwell time (Loitering or other duration events)
        dwell_q = db.query(
            Zone.name,
            func.avg(BehaviorEvent.duration)
        ).select_from(BehaviorEvent)\
         .join(Zone, BehaviorEvent.zone_id == Zone.id)\
         .filter(BehaviorEvent.video_id == video_id, BehaviorEvent.duration > 0.0)\
         .group_by(Zone.name).all()

        avg_dwell_times = [{"zone_name": item[0], "avg_dwell_seconds": round(float(item[1]), 1)} for item in dwell_q]

        # 4. Timeline details — use joinedload to prevent N+1 on zone.name access
        timeline_q = db.query(BehaviorEvent)\
                       .options(joinedload(BehaviorEvent.zone))\
                       .filter(BehaviorEvent.video_id == video_id)\
                       .order_by(asc(BehaviorEvent.start_timestamp)).all()
        
        timeline_events = []
        for e in timeline_q:
            timeline_events.append({
                "id": str(e.id),
                "track_id": e.track_id,
                "zone_name": e.zone.name if e.zone else "None",
                "event_type": e.event_type,
                "start_timestamp": e.start_timestamp,
                "end_timestamp": e.end_timestamp,
                "duration": e.duration,
                "description": e.metadata_json.get("description", "")
            })

        # Calculate global parameters
        total_events = db.query(func.count(BehaviorEvent.id)).filter(BehaviorEvent.video_id == video_id).scalar() or 0
        loitering_count = event_counts.get("Loitering", 0)
        security_alerts = event_counts.get("Restricted Area Entry", 0)

        return {
            "total_events": total_events,
            "loitering_count": loitering_count,
            "security_alerts_count": security_alerts,
            "event_type_counts": event_counts,
            "top_visited_zones": top_visited_zones,
            "average_dwell_times": avg_dwell_times,
            "timeline": timeline_events
        }
