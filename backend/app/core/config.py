import os
from typing import List, Union, Optional
from pydantic import AnyHttpUrl, BeforeValidator, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    APP_NAME: str = "SentralQ"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/sentralq"

    # CORS configuration
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_CORS_ORIGINS: List[str] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Auth configurations
    JWT_SECRET: str = "super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Video Asset Management configurations
    STORAGE_DIR: str = "storage"
    DELETE_PHYSICAL_VIDEO: bool = True
    FFMPEG_PATH: str = "ffmpeg"
    FFPROBE_PATH: str = "ffprobe"
    MAX_UPLOAD_SIZE: int = 2147483648  # 2GB

    # Vision Processing configurations
    FRAME_EXTRACTION_INTERVAL: float = 1.0
    MAX_CONCURRENT_JOBS: int = 2
    FRAME_STORAGE_PATH: str = "storage/frames"
    FRAME_CACHE_LIMIT: int = 1000

    # Grok / Llama LLM configurations
    GROK_API_KEY: Optional[str] = None
    GROK_API_BASE: str = "https://api.groq.com/openai/v1"
    GROK_MODEL_NAME: str = "llama-3.3-70b-versatile"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"


# Load settings
settings = Settings()
