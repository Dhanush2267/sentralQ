from sqlalchemy.orm import Session
from app.vision.pipeline import VisionPipeline
from app.vision.model_manager import ModelManager

# Instantiate static ModelManager instance for persistent model caching
model_manager = ModelManager()

class VisionProcessor:
    @staticmethod
    def process_job(db: Session, job_id) -> None:
        """
        Create and run a new VisionPipeline on the given job.
        """
        pipeline = VisionPipeline(db, model_manager)
        pipeline.execute(job_id)
