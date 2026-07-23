import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.repositories.user_repository import UserRepository
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.schemas.auth import (
    UserCreate,
    UserResponse,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    TokenRefreshResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    Dependency: Validate JWT access token and return the authenticated user.
    Raises 401 if token is missing, invalid, or the user is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise credentials_exception

    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception

    import uuid
    try:
        user = UserRepository.get(db, uuid.UUID(user_id))
    except (ValueError, Exception):
        raise credentials_exception

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive. Contact an administrator."
        )

    return user


def require_role(*roles: str):
    """
    Role-based access control dependency factory.
    Usage: Depends(require_role("admin", "analyst"))
    """
    def checker(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}. Your role: {current_user.role}"
            )
        return current_user
    return checker


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    """
    Register a new user. Email must be unique.
    Default role is 'viewer' unless specified.
    Only 'admin' and 'analyst' roles are allowed (guests/admin creation handled separately).
    """
    # Check email uniqueness
    existing = UserRepository.get_by_email(db, user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{user_in.email}' already exists."
        )

    # Validate role
    allowed_roles = {"admin", "analyst", "viewer", "guest"}
    if user_in.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{user_in.role}'. Allowed: {', '.join(allowed_roles)}"
        )

    user = UserRepository.create(
        db,
        email=user_in.email,
        full_name=user_in.full_name,
        password=user_in.password,
        role=user_in.role
    )
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive JWT tokens"
)
def login(login_data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Authenticate a user with email/password and return access + refresh tokens.
    Access token expires in 60 minutes; refresh token expires in 7 days.
    """
    user = UserRepository.get_by_email(db, login_data.email)

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please try again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an administrator."
        )

    token_data = {"sub": str(user.id), "email": user.email, "role": user.role}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    logger.info(f"User '{user.email}' logged in successfully.")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active
        )
    )


@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    summary="Refresh access token using refresh token"
)
def refresh_token(refresh_data: RefreshRequest, db: Session = Depends(get_db)) -> TokenRefreshResponse:
    """
    Exchange a valid refresh token for a new access token.
    The refresh token itself is not rotated (stateless approach).
    """
    payload = decode_token(refresh_data.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please log in again."
        )

    import uuid
    try:
        user = UserRepository.get(db, uuid.UUID(payload["sub"]))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")

    new_access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )
    return TokenRefreshResponse(access_token=new_access_token)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile"
)
def get_me(current_user=Depends(get_current_user)) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return current_user


@router.post(
    "/logout",
    summary="Log out (client-side token invalidation)"
)
def logout():
    """
    Stateless JWT logout.
    Instructs the client to delete stored tokens (no server-side blacklist).
    For production, implement a token blacklist in Redis.
    """
    return {"success": True, "message": "Logged out successfully. Please clear your local tokens."}
