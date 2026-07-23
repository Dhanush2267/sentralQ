from fastapi import APIRouter
from app.api.v1.endpoints import health, system, videos, processing, detection, tracking, zones, behavior, ai, reports, auth, analytics


api_router = APIRouter()

# Register routes under /api/v1/
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(health.router, prefix="/health", tags=["System & Diagnostics"])
api_router.include_router(system.router, prefix="/system", tags=["System & Diagnostics"])
api_router.include_router(videos.router, prefix="/videos", tags=["Videos"])
api_router.include_router(processing.router, prefix="/processing", tags=["Vision Processing"])
api_router.include_router(detection.router, prefix="/detection", tags=["Object Detection"])
api_router.include_router(tracking.router, prefix="/tracking", tags=["Object Tracking"])
api_router.include_router(zones.router, prefix="/zones", tags=["Zone Management"])
api_router.include_router(behavior.router, prefix="/behavior", tags=["Behavior Intelligence"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Search Assistant"])
api_router.include_router(reports.router, prefix="/reports", tags=["Surveillance Reports"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Surveillance Analytics"])



