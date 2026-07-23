from datetime import datetime
from pydantic import BaseModel, Field


class SystemInfoResponse(BaseModel):
    application_name: str = Field(..., description="The name of the application")
    version: str = Field(..., description="The running version of the application")
    environment: str = Field(..., description="The running environment (e.g., development, production)")


class HealthCheckResponse(BaseModel):
    status: str = Field(..., description="Operational status, e.g., 'healthy'")
    application_name: str = Field(..., description="The name of the application")
    version: str = Field(..., description="The running version of the application")
    timestamp: datetime = Field(..., description="Current server UTC timestamp")


class PlatformStatsResponse(BaseModel):
    """Global aggregate metrics for the surveillance operations dashboard."""
    total_videos: int = 0
    processing_videos: int = 0
    total_detections: int = 0
    total_tracks: int = 0
    total_behavior_events: int = 0
    security_alerts: int = 0


class SystemDetailsResponse(BaseModel):
    database_status: str
    database_url: str
    storage_used_bytes: int
    storage_total_bytes: int
    storage_free_bytes: int
    version: str
    environment: str


