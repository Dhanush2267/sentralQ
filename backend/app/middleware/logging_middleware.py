import logging
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log details about every incoming HTTP request,
    including paths, methods, response codes, and latency in milliseconds.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        
        # Log incoming request (optional, usually debug)
        logger.debug(f"Incoming: {request.method} {request.url.path}")

        try:
            response = await call_next(request)
            
            process_time_ms = (time.perf_counter() - start_time) * 1000.0
            logger.info(
                f"{request.method} {request.url.path} | Status: {response.status_code} | Duration: {process_time_ms:.2f}ms"
            )
            
            # Inject headers for diagnostic tracing
            response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.2f}"
            return response
        except Exception:
            # Let the exception handler middleware format the response, but record the time spent
            process_time_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(
                f"FAILED: {request.method} {request.url.path} | Duration: {process_time_ms:.2f}ms"
            )
            raise
