import logging
import time
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class GlobalExceptionHandlerMiddleware(BaseHTTPMiddleware):
    """
    Middleware that intercepts exceptions and maps them to unified, formatted JSON responses.
    This guarantees that the API client always receives a clean error payload rather than raw HTML.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        try:
            return await call_next(request)
        except StarletteHTTPException as exc:
            logger.warning(f"HTTP Exception on {request.method} {request.url.path}: {exc.detail}")
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "success": False,
                    "error": {
                        "code": "HTTP_EXCEPTION",
                        "message": exc.detail,
                        "details": None,
                    },
                },
            )
        except Exception as exc:
            logger.exception(
                f"Unhandled exception occurred processing {request.method} {request.url.path}: {str(exc)}"
            )
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected error occurred. Please contact system support.",
                        "details": str(exc) if request.app.debug else None,
                    },
                },
            )
