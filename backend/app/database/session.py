from typing import Generator
from sqlalchemy.orm import sessionmaker, Session
from app.database.database import engine

# Configured Session local generator
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a scoped database session.
    Automatically closes the connection context once the request lifecycle is complete.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
