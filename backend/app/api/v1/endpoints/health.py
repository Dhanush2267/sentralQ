import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.system import HealthCheckResponse
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=HealthCheckResponse)
def get_health(db: Session = Depends(get_db)) -> HealthCheckResponse:
    """
    Performs a health check on core services (Server, Database).
    If database connectivity fails, the API logs a warning.
    """
    status = "healthy"
    
    # Verify Database Connectivity
    try:
        # Executes a lightweight check
        db.execute(text("SELECT 1"))
    except Exception as e:
        status = "degraded"
        logger.warning(f"Database health check failed: {str(e)}")

    return HealthCheckResponse(
        status=status,
        application_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        timestamp=datetime.now(timezone.utc)
    )
