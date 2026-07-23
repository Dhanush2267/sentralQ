import uuid
import logging
from datetime import datetime
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from app.models.processing_job import ProcessingJob
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.video_repository import VideoRepository
from app.workers.processing_worker import dispatch_job

logger = logging.getLogger(__name__)

class ProcessingService:
    @staticmethod
    def start_processing(video_id: uuid.UUID, db: Session, background_tasks: BackgroundTasks) -> ProcessingJob:
        """
        Create a new ProcessingJob for a video and dispatch it to the background worker.
        """
        # 1. Verify video exists
        video = VideoRepository.get(db, video_id)
        if not video:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Video asset with ID {video_id} not found."
            )

        # 2. Check if a job is already running or queued
        existing_job = ProcessingRepository.get_by_video_id(db, video_id)
        if existing_job and existing_job.status in ["queued", "processing"]:
            logger.warning(f"Processing job already exists for video {video_id} with status '{existing_job.status}'")
            return existing_job

        # 3. Create a new ProcessingJob
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
        logger.info(f"Created new ProcessingJob {job.id} for video {video_id}")

        # 4. Dispatch the job in the background
        background_tasks.add_task(dispatch_job, job.id)
        
        return job

    @staticmethod
    def cancel_processing(video_id: uuid.UUID, db: Session) -> ProcessingJob:
        """
        Cancel an active vision processing job for a video.
        """
        job = ProcessingRepository.get_by_video_id(db, video_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No processing job found for video ID {video_id}."
            )

        if job.status not in ["queued", "processing"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel job in '{job.status}' status."
            )

        # Update job to cancelled/failed
        logger.info(f"Cancelling ProcessingJob {job.id} for video {video_id}")
        updated_job = ProcessingRepository.update(db, db_obj=job, obj_in={
            "status": "failed",
            "error_message": "Cancelled by user",
            "completed_at": datetime.utcnow(),
            "failed": datetime.utcnow()
        })
        
        return updated_job

    @staticmethod
    def get_status(video_id: uuid.UUID, db: Session) -> ProcessingJob:
        """
        Get the latest vision processing job status for a video.
        """
        job = ProcessingRepository.get_by_video_id(db, video_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No processing job found for video ID {video_id}."
            )
        return job

    @staticmethod
    def retry_processing(video_id: uuid.UUID, db: Session, background_tasks: BackgroundTasks) -> ProcessingJob:
        """
        Retry a failed processing job.
        """
        job = ProcessingRepository.get_by_video_id(db, video_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No processing job found for video ID {video_id}."
            )

        if job.status != "failed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot retry a job with status '{job.status}'. Only failed jobs can be retried."
            )

        logger.info(f"Retrying failed ProcessingJob {job.id} for video {video_id}")
        updated_job = ProcessingRepository.update(db, db_obj=job, obj_in={
            "status": "queued",
            "current_stage": "queued",
            "queued": datetime.utcnow(),
            "progress_percentage": 0.0,
            "total_frames": 0,
            "processed_frames": 0,
            "error_message": None,
            "started_at": None,
            "completed_at": None,
            "processing": None,
            "completed": None,
            "failed": None
        })

        background_tasks.add_task(dispatch_job, updated_job.id)
        return updated_job
