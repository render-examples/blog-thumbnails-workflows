"""Route handlers containing business logic for the Blog Thumbnail API."""

import json

import httpx
from config import (
    LOCAL_MODE,
    RENDER_API_KEY,
    WORKFLOW_ID,
    WORKFLOW_SLUG,
    GenerateRequest,
    StatusResponse,
    normalize_models,
)
from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from moderation import moderate_content
from pydantic import HttpUrl
from scraping import fetch_blog_context, fetch_blog_title
from storage import delete_image, ensure_bucket, get_s3_client, list_images
from utils import extract_error_message, get_render_client, log_full_error, to_sdk_error_response

# ============================================================================
# Health & Debug Endpoints
# ============================================================================


async def root():
    """GET / - Service info."""
    return {"service": "Blog Thumbnail API (Python)", "status": "ok"}


async def health():
    """GET /health - Health check."""
    return {"status": "ok", "mode": "local" if LOCAL_MODE else "remote"}


async def debug():
    """GET /api/debug - Debug endpoint to check configuration."""
    workflows_client = get_render_client()
    return {
        "api_key_set": bool(RENDER_API_KEY),
        "workflow_slug": WORKFLOW_SLUG,
        "client_initialized": workflows_client is not None,
        "local_mode": LOCAL_MODE,
    }


# ============================================================================
# Metadata Endpoint
# ============================================================================


async def metadata(url: HttpUrl):
    """GET /api/metadata - Fetch blog title from URL."""
    try:
        title = fetch_blog_title(str(url))
        return {"title": title}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch blog metadata: {e}") from e


# ============================================================================
# Generate Endpoint
# ============================================================================


async def generate(request: Request, req: GenerateRequest):
    """POST /api/generate - Start thumbnail generation task."""
    workflows_client = get_render_client()

    if not workflows_client:
        raise HTTPException(status_code=500, detail="Render workflows client not configured")
    if not WORKFLOW_SLUG:
        raise HTTPException(status_code=500, detail="WORKFLOW_SLUG not configured")

    # Fetch blog context if URL provided
    blog_context = ""
    if req.blogUrl:
        try:
            blog_context = fetch_blog_context(str(req.blogUrl))
        except Exception as e:
            print(f"[generate] Failed to fetch blog context: {e}")

    models = normalize_models(req)

    # Content moderation (runs unconditionally when OPENAI_API_KEY is set)
    texts_to_moderate = [t for t in [req.title, req.extraPrompt] if t]
    flagged, reason = await moderate_content(texts_to_moderate)
    if flagged:
        raise HTTPException(status_code=400, detail=reason)

    task_id = f"{WORKFLOW_SLUG}/generate_thumbnails"
    print(f"[generate] Calling task: {task_id}")
    print(
        f"[generate] Models: {models}, Style: {req.style}, Template: {req.template}, Font: {req.font}"
    )

    try:
        task_run = await workflows_client.workflows.run_task(
            task_identifier=task_id,
            input_data=[
                req.title,
                models,
                req.style,
                req.template,
                req.font,
                blog_context,
                req.extraPrompt or "",
            ],
        )
        print(f"[generate] Task started: {task_run.id}")
        return {"task_id": task_run.id, "status": "started"}
    except Exception as exc:
        log_full_error("Generate error", exc)
        status, message = to_sdk_error_response(exc)
        raise HTTPException(status_code=status, detail=message) from exc


# ============================================================================
# Task Status Endpoints
# ============================================================================


async def status(task_id: str):
    """GET /api/status/{task_id} - Get task status and results."""
    workflows_client = get_render_client()

    if not workflows_client:
        raise HTTPException(status_code=500, detail="Render workflows client not configured")

    try:
        task_run = await workflows_client.workflows.get_task_run(task_run_id=task_id)
        raw_results = task_run.results or []
        results = raw_results[0] if isinstance(raw_results, list) and raw_results else None
        return StatusResponse(status=task_run.status, results=results)
    except Exception as exc:
        status_code, message = to_sdk_error_response(exc)
        raise HTTPException(
            status_code=status_code, detail=f"Failed to fetch status: {message}"
        ) from exc


async def list_tasks():
    """GET /api/tasks - List recent task runs."""
    if not RENDER_API_KEY:
        raise HTTPException(status_code=500, detail="RENDER_API_KEY not configured")

    params = {"limit": "20"}
    if WORKFLOW_ID:
        params["workflowId"] = WORKFLOW_ID

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://api.render.com/v1/task-runs",
                params=params,
                headers={"Authorization": f"Bearer {RENDER_API_KEY}"},
                timeout=10.0,
            )
            response.raise_for_status()
            response_data = response.json()
            tasks = response_data if isinstance(response_data, list) else []
            return [
                {
                    "id": t.get("id"),
                    "status": t.get("status"),
                    "taskId": t.get("taskId"),
                    "startedAt": t.get("startedAt"),
                    "completedAt": t.get("completedAt"),
                }
                for t in tasks
            ]
        except httpx.HTTPError as exc:
            print(f"[list_tasks] Error: {exc}")
            raise HTTPException(status_code=500, detail=f"Failed to list tasks: {exc}") from exc


async def get_subtasks(root_task_id: str):
    """GET /api/subtasks/{root_task_id} - Get subtasks for progressive results."""
    if not RENDER_API_KEY:
        raise HTTPException(status_code=500, detail="RENDER_API_KEY not configured")

    workflows_client = get_render_client()

    # Get root task status
    root_status = "running"
    if workflows_client:
        try:
            root_task_run = await workflows_client.workflows.get_task_run(task_run_id=root_task_id)
            root_status = root_task_run.status
            print(f"[subtasks] Root task {root_task_id}: {root_status}")
        except Exception as e:
            print(f"[subtasks] Failed to get root task status: {e}")

    async with httpx.AsyncClient() as client:
        try:
            params = {"rootTaskRunId": root_task_id, "limit": "50"}
            if WORKFLOW_ID:
                params["workflowId"] = WORKFLOW_ID

            response = await client.get(
                "https://api.render.com/v1/task-runs",
                params=params,
                headers={"Authorization": f"Bearer {RENDER_API_KEY}"},
                timeout=10.0,
            )
            response.raise_for_status()
            response_data = response.json()

            all_tasks = response_data if isinstance(response_data, list) else []
            print(f"[subtasks] API returned {len(all_tasks)} tasks")

            # Filter out root task
            subtasks = [t for t in all_tasks if t.get("id") != root_task_id]
            print(f"[subtasks] Found {len(subtasks)} subtasks")

            # Fetch results for completed subtasks
            subtasks_with_results = []
            for subtask in subtasks:
                result_data = {
                    "id": subtask.get("id"),
                    "status": subtask.get("status"),
                    "taskId": subtask.get("taskId"),
                    "startedAt": subtask.get("startedAt"),
                    "completedAt": subtask.get("completedAt"),
                    "results": None,
                }

                if subtask.get("status") == "completed" and workflows_client:
                    try:
                        run = await workflows_client.workflows.get_task_run(
                            task_run_id=subtask.get("id")
                        )
                        result_data["results"] = run.results[0] if run.results else None
                    except Exception:
                        pass

                subtasks_with_results.append(result_data)

            completed_count = sum(1 for t in subtasks if t.get("status") == "completed")

            return {
                "rootTaskId": root_task_id,
                "rootStatus": root_status,
                "subtasks": subtasks_with_results,
                "totalSubtasks": len(subtasks),
                "completedSubtasks": completed_count,
            }
        except httpx.HTTPError as exc:
            print(f"[subtasks] Error: {exc}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch subtasks: {exc}") from exc


# ============================================================================
# SSE Streaming Endpoint
# ============================================================================


async def stream_task(task_id: str, request: Request):
    """GET /api/stream/{task_id} - SSE endpoint for task events."""
    if not RENDER_API_KEY:
        raise HTTPException(status_code=500, detail="RENDER_API_KEY not configured")

    async def event_generator():
        workflows_client = get_render_client()

        # Get initial state
        if workflows_client:
            try:
                task_run = await workflows_client.workflows.get_task_run(task_run_id=task_id)
                yield f"event: initial\ndata: {json.dumps({'id': task_run.id, 'status': task_run.status})}\n\n"

                if task_run.status in ("completed", "failed"):
                    results = task_run.results[0] if task_run.results else None
                    yield f"event: done\ndata: {json.dumps({'status': task_run.status, 'results': results})}\n\n"
                    return
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
                return

        # Connect to Render SSE
        sse_url = f"https://api.render.com/v1/task-runs/events?taskRunIds={task_id}"
        print(f"[SSE] Connecting to: {sse_url}")

        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream(
                    "GET",
                    sse_url,
                    headers={
                        "Authorization": f"Bearer {RENDER_API_KEY}",
                        "Accept": "text/event-stream",
                    },
                ) as response:
                    if response.status_code != 200:
                        yield f"event: error\ndata: {json.dumps({'error': f'SSE connection failed: {response.status_code}'})}\n\n"
                        return

                    buffer = ""
                    async for chunk in response.aiter_text():
                        if await request.is_disconnected():
                            print(f"[SSE] Client disconnected for {task_id}")
                            return

                        buffer += chunk
                        lines = buffer.split("\n")
                        buffer = lines.pop()

                        for line in lines:
                            if not line.startswith("data:"):
                                continue
                            data_str = line[5:].strip()
                            if not data_str:
                                continue

                            try:
                                event = json.loads(data_str)
                                yield f"event: taskUpdate\ndata: {json.dumps(event)}\n\n"

                                if event.get("id") == task_id and event.get("status") in (
                                    "completed",
                                    "failed",
                                ):
                                    if workflows_client:
                                        final_run = await workflows_client.workflows.get_task_run(
                                            task_run_id=task_id
                                        )
                                        results = (
                                            final_run.results[0] if final_run.results else None
                                        )
                                        yield f"event: done\ndata: {json.dumps({'status': final_run.status, 'results': results})}\n\n"
                                    return
                            except json.JSONDecodeError:
                                pass

            except httpx.HTTPError as e:
                print(f"[SSE] Connection error: {e}")
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ============================================================================
# Gallery Endpoints (NEW - parity with TypeScript API)
# ============================================================================


async def gallery_list():
    """GET /api/gallery - List all images in the gallery."""
    s3 = get_s3_client()
    if not s3:
        raise HTTPException(status_code=503, detail="MinIO not configured")

    try:
        ensure_bucket(s3)
        images = list_images(s3)
        return {"images": [img.model_dump() for img in images], "total": len(images)}
    except Exception as exc:
        print(f"[API] Gallery error: {exc}")
        raise HTTPException(status_code=500, detail=extract_error_message(exc)) from exc


async def gallery_delete(key: str):
    """DELETE /api/gallery - Delete an image from the gallery."""
    s3 = get_s3_client()
    if not s3:
        raise HTTPException(status_code=503, detail="MinIO not configured")

    if not key:
        raise HTTPException(status_code=400, detail="key query param is required")

    try:
        delete_image(s3, key)
        return {"success": True, "key": key}
    except Exception as exc:
        print(f"[API] Delete error: {exc}")
        raise HTTPException(status_code=500, detail=extract_error_message(exc)) from exc
