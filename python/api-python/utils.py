"""SDK helpers, error mapping, and utility functions."""

import os
from typing import Optional

from config import RENDER_API_KEY

try:
    from render_sdk import RenderAsync
    from render_sdk.client.errors import ClientError, RenderError, ServerError, TaskRunError
except ImportError:
    RenderAsync = None
    ClientError = None
    RenderError = None
    ServerError = None
    TaskRunError = None

# Singleton async Render client (required for FastAPI's async handlers)
_render_client: Optional["RenderAsync"] = None


def get_render_client() -> Optional["RenderAsync"]:
    """
    Get async Render SDK client (singleton).
    Supports local dev via RENDER_USE_LOCAL_DEV environment variable.
    """
    global _render_client

    if RenderAsync is None:
        return None

    if _render_client is not None:
        return _render_client

    if not RENDER_API_KEY:
        return None

    try:
        use_local = os.environ.get("RENDER_USE_LOCAL_DEV", "").lower() == "true"
        if use_local:
            _render_client = RenderAsync(token="local-dev", base_url="http://localhost:8120")
        else:
            _render_client = RenderAsync()
        print("[startup] Render client initialized")
        return _render_client
    except Exception as e:
        print(f"[startup] Failed to init Render client: {e}")
        return None


def to_sdk_error_response(error: Exception) -> tuple[int, str]:
    """
    Map Render SDK errors to HTTP status codes and messages.
    Returns (status_code, message) tuple.

    Error hierarchy:
    - TaskRunError: Task run failed during execution
    - ClientError (4xx): Invalid request to Render API
    - ServerError (5xx): Render API server error
    - RenderError (base): Generic Render API error
    - TimeoutError: Request timed out
    """
    # Check for timeout errors first
    if isinstance(error, TimeoutError):
        return 504, "Request to Render API timed out"

    # TaskRunError: raised by run_task when the task run itself fails
    if TaskRunError is not None and isinstance(error, TaskRunError):
        return 502, f"Task run failed: {error}"

    # ClientError: 4xx errors from the API
    if ClientError is not None and isinstance(error, ClientError):
        status_code = getattr(error, "status_code", None) or 400
        return status_code, error.message if hasattr(
            error, "message"
        ) else f"Invalid request to Render API: {str(error)}"

    # ServerError: 5xx errors from the API
    if ServerError is not None and isinstance(error, ServerError):
        status_code = getattr(error, "status_code", None) or 502
        return status_code, "Render API error"

    # RenderError: Base class for all Render errors
    if RenderError is not None and isinstance(error, RenderError):
        return 502, error.message if hasattr(
            error, "message"
        ) else f"Render API error: {str(error)}"

    # Fallback for unknown errors
    return 500, str(error) if str(error) else "Unexpected error"


def extract_error_message(error: Exception) -> str:
    """Extract a meaningful error message from an exception."""
    if hasattr(error, "message") and error.message:
        msg = error.message
        if "[object Object]" in msg:
            if hasattr(error, "body") and error.body:
                return str(error.body)
            if hasattr(error, "response") and error.response:
                return str(error.response)
            if hasattr(error, "cause") and error.cause:
                return extract_error_message(error.cause)
        return msg
    return str(error)


def log_full_error(label: str, error: Exception) -> None:
    """Log detailed error information for debugging."""
    print(f"[API] {label}: {error}")
    if hasattr(error, "statusCode"):
        print(f"  statusCode: {error.statusCode}")
    if hasattr(error, "response"):
        print(f"  response: {error.response}")
    if hasattr(error, "body"):
        print(f"  body: {error.body}")
    if hasattr(error, "cause"):
        print(f"  cause: {error.cause}")
    if hasattr(error, "__dict__"):
        props = [k for k in error.__dict__ if k not in ("args", "message")]
        if props:
            print(f"  props: {', '.join(props)}")
