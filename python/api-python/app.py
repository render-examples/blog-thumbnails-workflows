"""
Blog Thumbnail API (Python)

Entry point: server setup, middleware, and route mappings.
Business logic lives in handlers.py.
"""

import os

from config import DEMO_MODE, GenerateRequest, StatusResponse, log_startup_info
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from handlers import (
    debug,
    gallery_delete,
    gallery_list,
    generate,
    get_subtasks,
    health,
    list_tasks,
    metadata,
    root,
    status,
    stream_task,
)
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Create FastAPI app
app = FastAPI(title="Blog Thumbnail API (Python)")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Log startup configuration
log_startup_info()


# ============================================================================
# Route Mappings
# ============================================================================

# Health & Debug
app.get("/")(root)
app.get("/health")(health)
app.get("/api/debug")(debug)

# Metadata
app.get("/api/metadata")(metadata)


# Generate - with rate limiting (stricter in demo mode)
@app.post("/api/generate")
@limiter.limit("2/hour" if DEMO_MODE else "10/minute")
async def generate_route(request: Request, req: GenerateRequest):
    return await generate(request, req)


# Task Status
app.get("/api/status/{task_id}", response_model=StatusResponse)(status)
app.get("/api/tasks")(list_tasks)
app.get("/api/subtasks/{root_task_id}")(get_subtasks)

# SSE Streaming
app.get("/api/stream/{task_id}")(stream_task)

# Gallery (NEW - parity with TypeScript API)
app.get("/api/gallery")(gallery_list)


@app.delete("/api/gallery")
async def gallery_delete_route(key: str = Query(..., description="Image key to delete")):
    if DEMO_MODE:
        raise HTTPException(status_code=403, detail="Deleting images is disabled on the demo instance")
    return await gallery_delete(key)


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
