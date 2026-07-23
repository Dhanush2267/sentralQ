import uuid
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password

logger = logging.getLogger(__name__)


class UserRepository:
    @staticmethod
    def get(db: Session, user_id: uuid.UUID) -> Optional[User]:
        """Fetch a user by UUID."""
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        """Fetch a user by email address (case-insensitive)."""
        return db.query(User).filter(User.email == email.lower().strip()).first()

    @staticmethod
    def create(db: Session, *, email: str, full_name: str, password: str, role: str = "viewer") -> User:
        """
        Create a new user with a hashed password.
        Email is lowercased and trimmed before storage.
        """
        db_user = User(
            email=email.lower().strip(),
            full_name=full_name.strip(),
            hashed_password=hash_password(password),
            role=role,
            is_active=True
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        logger.info(f"Created new user: {db_user.email} (role: {db_user.role})")
        return db_user

    @staticmethod
    def update_active_status(db: Session, user: User, is_active: bool) -> User:
        """Enable or disable a user account."""
        user.is_active = is_active
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def exists_any(db: Session) -> bool:
        """Check if any users exist in the database (for initial seed check)."""
        return db.query(User.id).first() is not None
