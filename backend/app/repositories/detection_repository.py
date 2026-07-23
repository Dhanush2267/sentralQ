import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from app.models.detection_result import DetectionResult

class DetectionRepository:
    @staticmethod
    def create_many(db: Session, *, objs_in: List[dict]) -> List[DetectionResult]:
        """
        Bulk insert detection results.
        """
        db_objs = [DetectionResult(**obj) for obj in objs_in]
        db.bulk_save_objects(db_objs)
        db.commit()
        return db_objs

    @staticmethod
    def get_by_video_id(
        db: Session,
        video_id: uuid.UUID,
        class_name: Optional[str] = None,
        min_confidence: Optional[float] = None
    ) -> List[DetectionResult]:
        """
        Retrieve detections for a specific video, optionally filtered by class or confidence.
        """
        query = db.query(DetectionResult).filter(DetectionResult.video_id == video_id)
        
        if class_name:
            query = query.filter(DetectionResult.class_name.ilike(class_name))
        if min_confidence is not None:
            query = query.filter(DetectionResult.confidence >= min_confidence)
            
        # Order by frame number, then confidence descending
        return query.order_by(asc(DetectionResult.frame_number), desc(DetectionResult.confidence)).all()

    @staticmethod
    def get_frame_detections(
        db: Session,
        video_id: uuid.UUID,
        frame_number: int
    ) -> List[DetectionResult]:
        """
        Get detections on a specific frame number of a video.
        """
        return db.query(DetectionResult)\
                 .filter(DetectionResult.video_id == video_id, DetectionResult.frame_number == frame_number)\
                 .order_by(desc(DetectionResult.confidence))\
                 .all()

    @staticmethod
    def get_statistics_by_video_id(db: Session, video_id: uuid.UUID) -> Dict[str, Any]:
        """
        Query and compile object class detection statistics for a video.
        """
        # Fetch counts grouped by class_name
        class_counts = db.query(
            DetectionResult.class_name,
            func.count(DetectionResult.id).label("count")
        ).filter(DetectionResult.video_id == video_id)\
         .group_by(DetectionResult.class_name)\
         .all()
         
        counts_dict = {row[0].lower(): row[1] for row in class_counts}
        
        # Aggregate based on requirements:
        # People detected, Bags, Phones, Bottles, Chairs, Cups, Others
        people = counts_dict.get("person", 0)
        
        # Bags aggregate backpack, handbag, suitcase, handbag, luggage etc.
        bags = (
            counts_dict.get("backpack", 0) +
            counts_dict.get("handbag", 0) +
            counts_dict.get("suitcase", 0)
        )
        
        # Phones aggregate cell phone
        phones = counts_dict.get("cell phone", 0) + counts_dict.get("phone", 0)
        bottles = counts_dict.get("bottle", 0)
        chairs = counts_dict.get("chair", 0)
        cups = counts_dict.get("cup", 0)
        
        # Others represents any classes not counted above
        defined_classes = {"person", "backpack", "handbag", "suitcase", "cell phone", "phone", "bottle", "chair", "cup"}
        others = {}
        total_detections = 0
        
        for row in class_counts:
            cls_name = row[0]
            count = row[1]
            total_detections += count
            if cls_name.lower() not in defined_classes:
                others[cls_name] = count
                
        return {
            "people": people,
            "bags": bags,
            "phones": phones,
            "bottles": bottles,
            "chairs": chairs,
            "cups": cups,
            "others": others,
            "total_detections": total_detections
        }
