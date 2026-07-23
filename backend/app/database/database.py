import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

# Choose engine args based on DB backend (PostgreSQL vs SQLite)
connect_args = {}
engine_kwargs = {}

if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite-specific settings for testing
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL production configurations
    engine_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,  # 30 mins
        "pool_pre_ping": True  # Heartbeat ping before utilizing connection
    }

try:
    logger.info("Initializing database connection engine...")
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        **engine_kwargs
    )
except Exception as e:
    logger.error(f"Failed to create SQLAlchemy engine with URL: {settings.DATABASE_URL}. Error: {str(e)}")
    raise
