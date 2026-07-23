import logging
import uuid
from typing import Set
from app.core.config import settings
from app.database.session import SessionLocal
from app.repositories.processing_repository import ProcessingRepository

logger = logging.getLogger(__name__)

class VisionScheduler:
    # Set to track active jobs running on workers
    _active_jobs: Set[uuid.UUID] = set()

    @classmethod
    def acquire_slot(cls, job_id: uuid.UUID) -> bool:
        """
        Attempt to acquire a processing slot for a job.
        Returns True if acquired, False otherwise.
        """
        if len(cls._active_jobs) >= settings.MAX_CONCURRENT_JOBS:
            logger.info(f"VisionScheduler: Max concurrent slots ({settings.MAX_CONCURRENT_JOBS}) reached. Job {job_id} remains queued.")
            return False
        
        cls._active_jobs.add(job_id)
        logger.info(f"VisionScheduler: Job {job_id} acquired slot. Active slots: {len(cls._active_jobs)}/{settings.MAX_CONCURRENT_JOBS}")
        return True

    @classmethod
    def release_slot(cls, job_id: uuid.UUID) -> None:
        """
        Release the processing slot and schedule the next queued job.
        """
        if job_id in cls._active_jobs:
            cls._active_jobs.remove(job_id)
            logger.info(f"VisionScheduler: Job {job_id} released slot. Active slots: {len(cls._active_jobs)}/{settings.MAX_CONCURRENT_JOBS}")
            
        cls.trigger_next_queued()

    @classmethod
    def trigger_next_queued(cls) -> None:
        """
        Find and trigger the oldest queued processing job from the database.
        """
        if len(cls._active_jobs) >= settings.MAX_CONCURRENT_JOBS:
            return

        db = SessionLocal()
        try:
            next_job = ProcessingRepository.get_next_queued(db)
            if next_job:
                logger.info(f"VisionScheduler: Found next queued job: {next_job.id}. Dispatching to worker...")
                # Late import to prevent circular import loops
                from app.workers.processing_worker import dispatch_job
                dispatch_job(next_job.id)
        except Exception as e:
            logger.error(f"VisionScheduler: Error during trigger_next_queued: {str(e)}", exc_info=True)
        finally:
            db.close()
