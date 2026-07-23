import os
import uuid
import logging
from typing import Set
from fastapi import UploadFile, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.video import Video
from app.repositories.video_repository import VideoRepository
from app.services.video_storage_service import VideoStorageService
from app.services.video_metadata_service import VideoMetadataService
from app.services.thumbnail_service import ThumbnailService
from app.database.session import SessionLocal

logger = logging.getLogger(__name__)

# Allowed extensions
ALLOWED_EXTENSIONS: Set[str] = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

class VideoUploadService:
    @staticmethod
    def validate_file(file: UploadFile) -> str:
        """
        Validate file extension and size before upload.
        """
        _, ext = os.path.splitext(file.filename or "")
        ext = ext.lower()
        
        # 1. Validate extension
        if ext not in ALLOWED_EXTENSIONS:
            logger.warning(f"Rejected upload: unsupported format '{ext}' for file '{file.filename}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # 2. Check file size (Read content-length headers if available, or do a light check)
        # Note: In FastAPI, we can inspect file.size (if available) or check through spooling.
        # Let's inspect content length header or file size
        file_size = 0
        if file.headers.get("content-length"):
            try:
                file_size = int(file.headers.get("content-length", 0))
            except ValueError:
                pass
                
        if file_size > settings.MAX_UPLOAD_SIZE:
            logger.warning(f"Rejected upload: file too large ({file_size} bytes) for file '{file.filename}'")
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size allowed is {settings.MAX_UPLOAD_SIZE / (1024*1024*1024):.1f}GB."
            )
            
        return ext

    @classmethod
    def upload_video(
        cls,
        file: UploadFile,
        db: Session,
        background_tasks: BackgroundTasks
    ) -> Video:
        """
        Main synchronous upload path.
        Validates file, generates UUID, saves file to storage, creates base DB record,
        and schedules processing in background task.
        """
        logger.info(f"Video upload initiated: {file.filename}")
        
        # Validate file format and size headers
        ext = cls.validate_file(file)

        # Generate unique database and file references
        video_id = uuid.uuid4()
        relative_video_path = VideoStorageService.get_video_relative_path(video_id, file.filename)
        
        # Perform physical file storage
        absolute_video_path = VideoStorageService.store_video(file, relative_video_path)

        # Get final actual file size
        final_size = os.path.getsize(absolute_video_path)
        if final_size > settings.MAX_UPLOAD_SIZE:
            # Delete file if size check spooled over the limit
            VideoStorageService.delete_file(absolute_video_path)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeded the maximum limit of 2GB."
            )

        # Generate unique filename for record
        generated_filename = f"{video_id}{ext}"

        # Insert record in DB with "uploaded" status and "upload" stage
        video_data = {
            "id": video_id,
            "filename": generated_filename,
            "original_filename": file.filename,
            "file_path": absolute_video_path,
            "file_size": final_size,
            "status": "uploaded",
            "processing_stage": "upload",
            "deleted": False
        }
        
        try:
            db_video = VideoRepository.create(db, obj_in=video_data)
            logger.info(f"Database record created for video {video_id} with status='uploaded'")
        except Exception as e:
            # Cleanup storage on DB failures
            logger.error(f"Database insertion failed for video {video_id}, cleaning up file: {str(e)}")
            VideoStorageService.delete_file(absolute_video_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database failure: could not create video record. Detail: {str(e)}"
            )

        # Dispatch background pipeline processing
        background_tasks.add_task(cls._process_video_pipeline, video_id)
        
        return db_video

    @classmethod
    def _process_video_pipeline(cls, video_id: uuid.UUID) -> None:
        """
        Background task pipeline executing metadata extraction and thumbnail generation.
        Uses a separate DB session context for safety.
        """
        db = SessionLocal()
        try:
            # Fetch target record
            video = VideoRepository.get(db, video_id)
            if not video:
                logger.error(f"Background pipeline failed: video record {video_id} not found in DB")
                return

            logger.info(f"Background processing started for video {video_id}")
            
            # Step 1: Update status to "processing", stage to "metadata"
            VideoRepository.update(db, db_obj=video, obj_in={
                "status": "processing",
                "processing_stage": "metadata"
            })

            # Step 2: Run metadata extraction
            try:
                meta = VideoMetadataService.extract_metadata(video.file_path)
                
                # Update DB record with extracted technical features
                VideoRepository.update(db, db_obj=video, obj_in={
                    "duration": meta["duration"],
                    "fps": meta["fps"],
                    "width": meta["width"],
                    "height": meta["height"],
                    "codec": meta["codec"],
                    "video_format": meta["video_format"],
                    "metadata_json": meta["metadata_json"],
                    "processing_stage": "thumbnail"
                })
                logger.info(f"Background metadata extraction saved for video {video_id}")
            except Exception as e:
                logger.error(f"Background metadata extraction failed for video {video_id}: {str(e)}")
                # Mark as failed and stop pipeline
                VideoRepository.update(db, db_obj=video, obj_in={
                    "status": "failed",
                    "processing_stage": "metadata"
                })
                return

            # Step 3: Run thumbnail generation
            try:
                # Generate unique path relative to thumbnails folder
                relative_thumb_path = VideoStorageService.get_thumbnail_relative_path(video_id)
                absolute_thumb_path = ThumbnailService.generate_thumbnail(video.file_path, relative_thumb_path)
                
                # Update DB record with thumbnail location and complete pipeline
                VideoRepository.update(db, db_obj=video, obj_in={
                    "thumbnail_path": absolute_thumb_path,
                    "status": "completed",
                    "processing_stage": "completed"
                })
                logger.info(f"Background processing pipeline completed successfully for video {video_id}")

                # Dispatch Vision AI processing pipeline (Frame Extraction, YOLO Detection, ByteTrack, Behavior Engine)
                try:
                    from datetime import datetime
                    from app.repositories.processing_repository import ProcessingRepository
                    from app.workers.processing_worker import dispatch_job

                    # Create ProcessingJob if none exists
                    job = ProcessingRepository.get_by_video_id(db, video_id)
                    if not job:
                        job_data = {
                            "video_id": video_id,
                            "status": "queued",
                            "current_stage": "queued",
                            "queued": datetime.utcnow(),
                            "progress_percentage": 0.0,
                            "total_frames": 0,
                            "processed_frames": 0
                        }
                        job = ProcessingRepository.create(db, obj_in=job_data)
                        logger.info(f"Auto-dispatch: Created ProcessingJob {job.id} for uploaded video {video_id}")

                    dispatch_job(job.id)
                    logger.info(f"Auto-dispatch: Dispatched Vision processing for job {job.id}")
                except Exception as dispatch_err:
                    logger.error(f"Auto-dispatch failed for video {video_id}: {str(dispatch_err)}", exc_info=True)
            except Exception as e:
                logger.error(f"Background thumbnail generation failed for video {video_id}: {str(e)}")
                # Mark as failed (metadata is already saved, but processing failed)
                VideoRepository.update(db, db_obj=video, obj_in={
                    "status": "failed",
                    "processing_stage": "thumbnail"
                })
                return

        except Exception as e:
            logger.error(f"Fatal background pipeline failure for video {video_id}: {str(e)}")
        finally:
            db.close()
