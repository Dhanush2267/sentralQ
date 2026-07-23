import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.middleware.exception_handler import GlobalExceptionHandlerMiddleware
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.database.session import get_db
from app.api.v1.router import api_router
from app.api.v1.endpoints.health import get_health
from app.schemas.system import HealthCheckResponse

# Initialize Centralized Logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    All startup logic runs before `yield`; shutdown logic runs after.
    This avoids module-level side effects that cause duplicate registrations.
    """
    # ── STARTUP ──────────────────────────────────────────────────────────
    logger.info("SentralQ platform starting up...")

    # Register the Behavior Engine as a listener for the Tracking Engine hook.
    # Done here (not in behavior_service.py module level) to prevent duplicate
    # registrations when the module is imported multiple times.
    from app.services.tracking_service import BehaviorEngineHook
    from app.services.behavior_service import run_behavior_on_tracking_completed

    # Guard against duplicate registration (e.g., hot-reload scenarios)
    if run_behavior_on_tracking_completed not in BehaviorEngineHook._listeners:
        BehaviorEngineHook.register_listener(run_behavior_on_tracking_completed)
        logger.info("Behavior Engine hook registered successfully.")
    else:
        logger.info("Behavior Engine hook already registered, skipping duplicate.")

    logger.info(f"SentralQ {settings.APP_VERSION} is online [{settings.ENVIRONMENT}].")

    # ── Seed default admin user on first run ──────────────────────────────
    try:
        from app.database.session import SessionLocal
        from app.repositories.user_repository import UserRepository
        db = SessionLocal()
        try:
            if not UserRepository.exists_any(db):
                admin = UserRepository.create(
                    db,
                    email="admin@sentralq.com",
                    full_name="Platform Administrator",
                    password="admin123",
                    role="admin"
                )
                logger.info(f"Default admin user seeded: {admin.email} (password: admin123)")
            else:
                logger.info("Admin user already exists, skipping seed.")
        finally:
            db.close()
    except Exception as seed_err:
        logger.warning(f"Could not seed default admin user: {seed_err}")


    yield  # Application runs here

    # ── SHUTDOWN ─────────────────────────────────────────────────────────
    logger.info("SentralQ platform shutting down. Cleaning up resources...")


def create_app() -> FastAPI:
    """
    Application factory pattern for configuring and returning the FastAPI instance.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Surveillance Intelligence Platform API",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan
    )

    # 1. Custom Logging & Diagnostic Middleware
    app.add_middleware(RequestLoggingMiddleware)
    
    # 2. Custom Exception Handlers
    app.add_middleware(GlobalExceptionHandlerMiddleware)

    # 3. CORS Configuration
    origins = [settings.FRONTEND_URL]
    if settings.BACKEND_CORS_ORIGINS:
        origins.extend(settings.BACKEND_CORS_ORIGINS)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 4. Include API Route endpoints
    app.include_router(api_router, prefix="/api/v1")

    # 5. Direct top-level health endpoint (GET /health)
    @app.get(
        "/health",
        response_model=HealthCheckResponse,
        tags=["System & Diagnostics"],
        summary="Root health status check"
    )
    def root_health(db: Session = Depends(get_db)) -> HealthCheckResponse:
        return get_health(db)

    logger.info("FastAPI application factory configuration completed successfully.")
    return app


app = create_app()

