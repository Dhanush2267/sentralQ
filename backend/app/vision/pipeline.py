import os
import time
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.video_repository import VideoRepository
from app.vision.frame_extractor import FrameExtractor
from app.vision.frame_cache import FrameCache
from app.vision.model_manager import ModelManager
from app.core.config import settings

logger = logging.getLogger(__name__)

class VisionPipeline:
    def __init__(self, db: Session, model_manager: ModelManager):
        self.db = db
        self.model_manager = model_manager

    def execute(self, job_id) -> None:
        """
        Execute the vision processing pipeline stages.
        """
        # Load the latest job state
        job = ProcessingRepository.get(self.db, job_id)
        if not job:
            logger.error(f"Pipeline execution aborted: Processing job {job_id} not found in database.")
            return

        video = VideoRepository.get(self.db, job.video_id)
        if not video:
            logger.error(f"Pipeline execution aborted: Video {job.video_id} not found in database.")
            ProcessingRepository.update(self.db, db_obj=job, obj_in={
                "status": "failed",
                "current_stage": "queued",
                "failed": datetime.utcnow(),
                "completed_at": datetime.utcnow(),
                "error_message": f"Associated video asset {job.video_id} not found."
            })
            return

        logger.info(f"VisionPipeline execution started for Video ID: {video.id}, Job ID: {job.id}")
        start_time = time.time()

        try:
            # 1. Start processing and enter Frame Extraction stage
            ProcessingRepository.update(self.db, db_obj=job, obj_in={
                "status": "processing",
                "current_stage": "frame_extraction",
                "processing": datetime.utcnow(),
                "started_at": datetime.utcnow(),
                "progress_percentage": 10.0
            })
            logger.info(f"Video ID: {video.id} | Stage: frame_extraction | Elapsed Time: {time.time() - start_time:.2f}s | Frames Extracted: 0")

            if self._check_cancelled(job_id):
                return

            # 2. Extract frames using FrameExtractor (check cache first)
            video_uuid = str(video.id)
            interval = settings.FRAME_EXTRACTION_INTERVAL
            output_dir = os.path.join(settings.FRAME_STORAGE_PATH, video_uuid)

            cached_frames = FrameCache.get_frames(video_uuid, interval)
            if cached_frames:
                frame_paths = cached_frames
                total_frames = len(frame_paths)
                logger.info(f"Video ID: {video.id} | Frame cache HIT! Reusing {total_frames} cached frames.")
            else:
                total_frames = FrameExtractor.extract_frames(video.file_path, output_dir, interval)
                frame_paths = [os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.endswith(".jpg")]
                FrameCache.add_frames(video_uuid, interval, frame_paths)

            ProcessingRepository.update(self.db, db_obj=job, obj_in={
                "total_frames": total_frames,
                "progress_percentage": 40.0
            })
            logger.info(f"Video ID: {video.id} | Stage: frame_extraction completed | Elapsed Time: {time.time() - start_time:.2f}s | Frames Extracted: {total_frames}")

            if self._check_cancelled(job_id):
                return

            # 3. Enter Frame Validation stage
            ProcessingRepository.update(self.db, db_obj=job, obj_in={
                "current_stage": "frame_validation",
                "progress_percentage": 50.0
            })
            logger.info(f"Video ID: {video.id} | Stage: frame_validation | Elapsed Time: {time.time() - start_time:.2f}s | Frames Extracted: {total_frames}")

            # Basic validation: ensure file size is greater than 0 bytes
            valid_frame_paths = []
            for path in frame_paths:
                if os.path.exists(path) and os.path.getsize(path) > 0:
                    valid_frame_paths.append(path)
                else:
                    logger.warning(f"Frame validation failure for: {path}")

            if len(valid_frame_paths) == 0 and total_frames > 0:
                raise RuntimeError("All extracted frames failed validation (missing files or empty size).")

            if self._check_cancelled(job_id):
                return

            # 4. Enter AI Ready stage (simulated inference runs here)
            ProcessingRepository.update(self.db, db_obj=job, obj_in={
                "current_stage": "ai_ready",
                "progress_percentage": 70.0
            })
            logger.info(f"Video ID: {video.id} | Stage: ai_ready | Elapsed Time: {time.time() - start_time:.2f}s | Frames Extracted: {total_frames}")

            # Load YOLO model from model manager (lazily loaded)
            yolo_model = self.model_manager.load_model("YOLO")
            
            # Clear existing detections for this video to avoid duplicates on retry
            from app.models.detection_result import DetectionResult
            self.db.query(DetectionResult).filter(DetectionResult.video_id == video.id).delete()
            self.db.commit()
            
            processed_count = 0
            total_valid = len(valid_frame_paths)
            for frame_path in valid_frame_paths:
                if self._check_cancelled(job_id):
                    return
                
                # Perform inference, save results, and generate frame overlays
                from app.services.detection_service import DetectionService
                DetectionService.run_detection_for_frame(
                    db=self.db,
                    video_id=video.id,
                    processing_job_id=job.id,
                    frame_path=frame_path,
                    detector=yolo_model
                )
                
                processed_count += 1
                
                # Incremental progress updates (scaling between 70% and 90%)
                pct = 70.0 + (float(processed_count) / total_valid) * 20.0
                ProcessingRepository.update(self.db, db_obj=job, obj_in={
                    "processed_frames": processed_count,
                    "progress_percentage": round(pct, 1)
                })

            if self._check_cancelled(job_id):
                return

            # 5. Run ByteTrack tracking and Behavior Intelligence rules engine
            try:
                logger.info(f"Video ID: {video.id} | Running ByteTrack tracking and behavior engine...")
                from app.services.tracking_service import TrackingService
                TrackingService.run_tracking(video.id, self.db)
                logger.info(f"Video ID: {video.id} | Tracking and behavior engine completed successfully.")
            except Exception as track_err:
                logger.error(f"Video ID: {video.id} | Tracking/behavior engine failed: {str(track_err)}", exc_info=True)

            # 6. Completed successfully
            ProcessingRepository.update(self.db, db_obj=job, obj_in={
                "status": "completed",
                "current_stage": "completed",
                "progress_percentage": 100.0,
                "completed": datetime.utcnow(),
                "completed_at": datetime.utcnow()
            })
            logger.info(f"Video ID: {video.id} | Stage: completed | Elapsed Time: {time.time() - start_time:.2f}s | Frames Extracted: {total_frames} | Errors: None")

        except Exception as e:
            logger.error(f"VisionPipeline execution failed for Job {job_id}: {str(e)}", exc_info=True)
            # Update job state to failed
            ProcessingRepository.update(self.db, db_obj=job, obj_in={
                "status": "failed",
                "current_stage": job.current_stage,
                "failed": datetime.utcnow(),
                "completed_at": datetime.utcnow(),
                "error_message": str(e)
            })

    def _check_cancelled(self, job_id) -> bool:
        """
        Helper method to check if job has been cancelled by user.
        """
        # Expire current ORM cache to retrieve latest changes committed from API
        self.db.expire_all()
        job = ProcessingRepository.get(self.db, job_id)
        if job and job.status == "failed" and job.error_message == "Cancelled by user":
            logger.warning(f"Job {job_id} cancellation detected in pipeline loop. Aborting.")
            return True
        return False
