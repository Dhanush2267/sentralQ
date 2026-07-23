import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: str
    full_name: str
    role: str = "viewer"


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: str = "viewer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
