import os
import time
import logging
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.repositories.video_repository import VideoRepository
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.detection_repository import DetectionRepository
from app.models.detection_result import DetectionResult
from app.detection.detector import YOLODetector
from app.detection.overlay import draw_detections

logger = logging.getLogger(__name__)

class DetectionService:
    @staticmethod
    def run_detection_for_frame(
        db: Session,
        video_id: uuid.UUID,
        processing_job_id: uuid.UUID,
        frame_path: str,
        detector: YOLODetector
    ) -> List[Dict[str, Any]]:
        """
        Run YOLO detection on a single frame, save the results in PostgreSQL DB, and generate the overlay image.
        """
        filename = os.path.basename(frame_path)
        try:
            frame_number = int(filename.split(".")[0])
        except ValueError:
            logger.warning(f"Could not parse frame number from filename '{filename}'. Defaulting to 1.")
            frame_number = 1
            
        timestamp_seconds = (frame_number - 1) * settings.FRAME_EXTRACTION_INTERVAL
        
        start_time = time.time()
        # Perform detection (which returns a list of detections for this frame)
        detections = detector.detect(frame_path)[0]
        inference_duration = time.time() - start_time
        
        logger.info(f"YOLO Inference for frame {frame_number} completed in {inference_duration:.4f}s. Detected {len(detections)} objects.")
        
        # Format for DB storage
        db_detections = []
        for det in detections:
            db_detections.append({
                "video_id": video_id,
                "processing_job_id": processing_job_id,
                "frame_number": frame_number,
                "timestamp_seconds": timestamp_seconds,
                "class_name": det["class_name"],
                "confidence": det["confidence"],
                "bbox_x": det["bbox_x"],
                "bbox_y": det["bbox_y"],
                "bbox_width": det["bbox_width"],
                "bbox_height": det["bbox_height"],
                "model_name": det["model_name"],
                "model_version": det["model_version"]
            })
            
        if db_detections:
            DetectionRepository.create_many(db, objs_in=db_detections)
            
        # Draw overlay and save to storage/detections/video_uuid/frame_number.jpg
        overlay_dir = os.path.join(settings.STORAGE_DIR, "detections", str(video_id))
        overlay_path = os.path.join(overlay_dir, f"{frame_number}.jpg")
        
        draw_detections(frame_path, detections, overlay_path)
        
        return detections

    @staticmethod
    def run_detection_for_video(video_id: uuid.UUID, db: Session) -> int:
        """
        Explicitly run detection on all already-extracted frames of a video.
        """
        video = VideoRepository.get(db, video_id)
        if not video:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Video asset with ID {video_id} not found."
            )
            
        job = ProcessingRepository.get_by_video_id(db, video_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No processing job exists for video ID {video_id}. Run vision pipeline first."
            )
            
        output_dir = os.path.join(settings.FRAME_STORAGE_PATH, str(video_id))
        if not os.path.exists(output_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Extracted frames not found on disk. Run vision pipeline first."
            )
            
        frame_files = sorted([f for f in os.listdir(output_dir) if f.endswith(".jpg")])
        if not frame_files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No frames extracted for this video asset."
            )
            
        detector = YOLODetector()
        
        # Clear existing detections for this video to avoid duplicates on re-run
        db.query(DetectionResult).filter(DetectionResult.video_id == video_id).delete()
        db.commit()
        
        total_detections = 0
        for f in frame_files:
            frame_path = os.path.join(output_dir, f)
            dets = DetectionService.run_detection_for_frame(db, video_id, job.id, frame_path, detector)
            total_detections += len(dets)
            
        return total_detections

    @staticmethod
    def get_detections(db: Session, video_id: uuid.UUID) -> List[Any]:
        return DetectionRepository.get_by_video_id(db, video_id)

    @staticmethod
    def get_statistics(db: Session, video_id: uuid.UUID) -> Dict[str, Any]:
        return DetectionRepository.get_statistics_by_video_id(db, video_id)

    @staticmethod
    def get_frame_path(video_id: uuid.UUID, frame_number: int) -> str:
        """
        Get absolute path of the annotated frame. If not detected yet, fallback to raw frame.
        """
        overlay_path = os.path.join(settings.STORAGE_DIR, "detections", str(video_id), f"{frame_number}.jpg")
        if os.path.exists(overlay_path):
            return overlay_path
            
        # Fallback: check raw frame
        raw_frame_path = os.path.join(settings.FRAME_STORAGE_PATH, str(video_id), f"{frame_number:06d}.jpg")
        if os.path.exists(raw_frame_path):
            return raw_frame_path
            
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frame {frame_number} for video ID {video_id} not found."
        )
