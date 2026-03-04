"""Render workflow tasks for blog thumbnail generation (Python)."""

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from render_sdk import Retry, Workflows

# Load .env.local from repo root (local dev only)
if os.getenv("NODE_ENV") != "production":
    env_path = Path(__file__).resolve().parent.parent.parent / ".env.local"
    load_dotenv(dotenv_path=env_path)

try:
    from .generator import generate_thumbnail as _generate_thumbnail
except ImportError:
    from generator import generate_thumbnail as _generate_thumbnail


# Initialize workflows app with defaults
app = Workflows(
    default_retry=Retry(max_retries=2, wait_duration_ms=5000, backoff_scaling=2.0),
    default_timeout=300,
)


# Subtask: generates a single thumbnail for one model
# When called from generate_thumbnails, runs as a distributed subtask
@app.task(name="generateThumbnail")
async def generate_thumbnail(
    title: str,
    model: str,
    style: str,
    template: str,
    font: str,
    context: str = "",
    extra_prompt: str = "",
) -> dict[str, str]:
    print(f"[generate_thumbnail] model={model}")
    result = _generate_thumbnail(title, model, style, template, font, context, extra_prompt)
    print(f"[generate_thumbnail] done model={model}")
    return result


# Main task: spawns subtasks for each model in parallel
@app.task(name="generateThumbnails")
async def generate_thumbnails(
    title: str,
    models: list[str],
    style: str,
    template: str,
    font: str,
    context: str = "",
    extra_prompt: str = "",
) -> dict[str, object]:
    print(f"[generate_thumbnails] models={','.join(models)}")

    subtasks = [
        generate_thumbnail(title, model, style, template, font, context, extra_prompt)
        for model in models
    ]
    results = await asyncio.gather(*subtasks)

    print(f"[generate_thumbnails] done count={len(results)}")
    return {
        "title": title,
        "style": style,
        "template": template,
        "font": font,
        "results": results,
    }


if __name__ == "__main__":
    app.start()
