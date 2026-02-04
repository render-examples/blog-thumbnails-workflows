"""Content moderation via OpenAI's Moderation API."""

import os

import httpx
from config import ENABLE_MODERATION

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


async def moderate_content(texts: list[str]) -> tuple[bool, str | None]:
    """Check texts against OpenAI's Moderation API.

    Only runs when ENABLE_MODERATION=true and OPENAI_API_KEY is set.
    Returns (flagged, reason) tuple.
    """
    if not ENABLE_MODERATION or not OPENAI_API_KEY or not texts:
        return False, None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/moderations",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                json={"input": texts},
            )
            resp.raise_for_status()
            data = resp.json()

        for result in data.get("results", []):
            if result.get("flagged"):
                cats = [
                    k.replace("/", " / ")
                    for k, v in result.get("categories", {}).items()
                    if v
                ]
                reason = (
                    f"Your prompt was flagged for inappropriate content"
                    f" ({', '.join(cats)}). Please revise and try again."
                )
                return True, reason

        return False, None
    except Exception as exc:
        print(f"[moderation] OpenAI moderation check failed: {exc}")
        return False, None
