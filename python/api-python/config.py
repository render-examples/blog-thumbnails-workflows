"""Configuration and environment variables for the Blog Thumbnail API."""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

# Load .env.local from repo root (local dev only)
if os.getenv("NODE_ENV") != "production":
    env_path = Path(__file__).resolve().parent.parent.parent / ".env.local"
    load_dotenv(dotenv_path=env_path)

# Load shared config (single source of truth)
SHARED_DIR = Path(__file__).resolve().parent.parent.parent / "shared"
STYLES_CONFIG = json.loads((SHARED_DIR / "styles.json").read_text())
TEMPLATES_CONFIG = json.loads((SHARED_DIR / "templates.json").read_text())
FONTS_CONFIG = json.loads((SHARED_DIR / "fonts.json").read_text())

# Build validation tuples from shared config
VALID_STYLES = tuple(STYLES_CONFIG.keys())
VALID_TEMPLATES = tuple(TEMPLATES_CONFIG.keys())
VALID_FONTS = tuple(FONTS_CONFIG.keys())

# Constants
MAX_CONTEXT_CHARS = 2500

# Environment variables
RENDER_API_KEY = os.getenv("RENDER_API_KEY", "")
WORKFLOW_SLUG = os.getenv("WORKFLOW_SLUG")
WORKFLOW_ID = os.getenv("WORKFLOW_ID", "")
LOCAL_MODE = os.getenv("LOCAL_MODE", "").lower() == "true"
DEMO_MODE = os.getenv("DEMO_MODE", "").lower() == "true"
ENABLE_MODERATION = os.getenv("ENABLE_MODERATION", "").lower() == "true"


# MinIO/S3 config (for Gallery feature)
class MinioConfig:
    endpoint: str = os.getenv("MINIO_ENDPOINT", "")
    access_key: str = os.getenv("MINIO_ACCESS_KEY", "")
    secret_key: str = os.getenv("MINIO_SECRET_KEY", "")
    bucket: str = os.getenv("MINIO_BUCKET", "thumbnails")
    public_base_url: str = os.getenv("MINIO_PUBLIC_BASE_URL", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.endpoint and self.access_key and self.secret_key)


minio_config = MinioConfig()


# Request/Response models
class GenerateRequest(BaseModel):
    """Request body for thumbnail generation."""

    title: str = Field(..., min_length=3, max_length=200)
    model: str | None = None
    models: list[str] | None = Field(default=None, max_length=5)
    style: str = "photorealistic"
    template: str = "bottom-bar"
    font: str = "inter"
    blogUrl: str | None = None
    extraPrompt: str | None = Field(default=None, max_length=500)

    @field_validator("style")
    @classmethod
    def validate_style(cls, v: str) -> str:
        if v not in VALID_STYLES:
            raise ValueError(f"Invalid style: {v}. Must be one of: {', '.join(VALID_STYLES)}")
        return v

    @field_validator("template")
    @classmethod
    def validate_template(cls, v: str) -> str:
        if v not in VALID_TEMPLATES:
            raise ValueError(f"Invalid template: {v}. Must be one of: {', '.join(VALID_TEMPLATES)}")
        return v

    @field_validator("font")
    @classmethod
    def validate_font(cls, v: str) -> str:
        if v not in VALID_FONTS:
            raise ValueError(f"Invalid font: {v}. Must be one of: {', '.join(VALID_FONTS)}")
        return v

    @field_validator("models")
    @classmethod
    def validate_models(cls, v):
        if v and len(v) > 5:
            raise ValueError("Maximum 5 models allowed")
        return v


class StatusResponse(BaseModel):
    """Response model for task status."""

    status: str
    results: dict | None = None


class GalleryImage(BaseModel):
    """Model for a gallery image."""

    key: str
    url: str
    last_modified: str | None = None
    size: int | None = None


def normalize_models(req: GenerateRequest) -> list[str]:
    """Normalize model selection from request."""
    if req.models and len(req.models) > 0:
        return req.models
    if req.model:
        return [req.model]
    return ["gemini-3-pro-image-preview"]


# Startup logging
def log_startup_info():
    """Log configuration on startup."""
    print(f"[startup] RENDER_API_KEY set: {bool(RENDER_API_KEY)}")
    print(f"[startup] WORKFLOW_SLUG: {WORKFLOW_SLUG}")
    print(f"[startup] LOCAL_MODE: {LOCAL_MODE}")
    print(f"[startup] Valid styles: {VALID_STYLES}")
    print(f"[startup] MinIO configured: {minio_config.is_configured}")
