# The declarative base class that all database models inherit from.
from app.database.base_class import Base

# To allow Alembic autogenerate to work, we import models here.
from app.models.video import Video
from app.models.processing_job import ProcessingJob
from app.models.detection_result import DetectionResult
from app.models.track import Track
from app.models.zone import Zone
from app.models.behavior_event import BehaviorEvent
from app.models.report import Report


