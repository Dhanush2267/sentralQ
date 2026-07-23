import uuid
import logging
import threading
from app.database.session import SessionLocal
from app.vision.processor import VisionProcessor
from app.vision.scheduler import VisionScheduler

logger = logging.getLogger(__name__)

def process_job_task(job_id: uuid.UUID) -> None:
    """
    Background worker execution task for a job.
    Uses the VisionScheduler to ensure MAX_CONCURRENT_JOBS limits are respected.
    """
    logger.info(f"Worker thread: starting processing execution for Job {job_id}")
    
    # Try to acquire a processing slot
    if not VisionScheduler.acquire_slot(job_id):
        # Remaining slot not available; the job remains in "queued" status
        return

    db = SessionLocal()
    try:
        VisionProcessor.process_job(db, job_id)
    except Exception as e:
        logger.error(f"Worker thread error during Job {job_id}: {str(e)}", exc_info=True)
    finally:
        db.close()
        # Release slot and trigger next queued job if any
        VisionScheduler.release_slot(job_id)

def dispatch_job(job_id: uuid.UUID) -> None:
    """
    Dispatches a processing job asynchronously in a daemon thread.
    Can easily be swapped for a Celery queue submit in the future.
    """
    thread = threading.Thread(target=process_job_task, args=(job_id,))
    thread.daemon = True
    thread.start()
    logger.info(f"Worker: Job {job_id} dispatched in background thread.")
