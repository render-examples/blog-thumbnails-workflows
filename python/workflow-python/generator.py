"""Generate images with AI providers and apply text overlays."""

from __future__ import annotations

import base64
import io
import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from .image_utils import apply_template, resize_and_crop
    from .storage import generate_image_key, upload_pil_image
except ImportError:
    from image_utils import apply_template, resize_and_crop
    from storage import generate_image_key, upload_pil_image

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Load shared config
SHARED_DIR = Path(__file__).parent.parent.parent / "shared"
STYLE_DESCRIPTIONS = json.loads((SHARED_DIR / "styles.json").read_text())


def _openai_client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=OPENAI_API_KEY)


def _build_prompt(title: str, style: str, context: str, extra_prompt: str) -> str:
    style_desc = STYLE_DESCRIPTIONS.get(style, STYLE_DESCRIPTIONS["photorealistic"])
    base = f"{style_desc}. Create a wide image to illustrate a blog post titled '{title}'."
    if context:
        base += f" Context: {context}"
    if extra_prompt:
        base += f" Additional guidelines: {extra_prompt}"
    base += " No text, letters, or words in the image. No logos or watermarks."
    return base


def _image_from_b64(data: str) -> Image.Image:
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw))


def _generate_openai_image(model: str, prompt: str) -> Image.Image:
    client = _openai_client()

    # GPT image models use different params than DALL-E
    is_gpt_image_model = model.startswith("gpt-image")

    if is_gpt_image_model:
        # GPT image models: always return base64, use output_format not response_format
        response = client.images.generate(
            model=model,
            prompt=prompt,
            size="1536x1024",  # landscape for blog thumbnails
            output_format="jpeg",
            output_compression=85,
        )
    else:
        # DALL-E models: use response_format
        size = "1792x1024" if model == "dall-e-3" else "1024x1024"
        response = client.images.generate(
            model=model,
            prompt=prompt,
            size=size,
            response_format="b64_json",
        )

    return _image_from_b64(response.data[0].b64_json)


def _generate_gemini_image(prompt: str) -> Image.Image:
    if not GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is not configured")
    from google import genai

    client = genai.Client(api_key=GOOGLE_API_KEY)
    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=[prompt],
    )
    for part in response.candidates[0].content.parts:
        if getattr(part, "inline_data", None) is not None:
            return Image.open(io.BytesIO(part.inline_data.data))
    raise RuntimeError("Gemini response did not include image data")


def generate_thumbnail(
    title: str,
    model: str,
    style: str,
    template: str,
    font: str,
    context: str = "",
    extra_prompt: str = "",
) -> dict[str, str]:
    try:
        logger.info(f"Building prompt for model={model}")
        prompt = _build_prompt(title, style, context, extra_prompt)
        logger.info("Prompt built, calling AI...")

        if model.startswith("gemini"):
            base_image = _generate_gemini_image(prompt)
        else:
            base_image = _generate_openai_image(model, prompt)
        logger.info("AI image received")

        base_image = resize_and_crop(base_image)
        logger.info("Image resized")

        final_image = apply_template(base_image, title, template, font)
        logger.info("Overlay applied")

        # Upload to MinIO and return URL
        key = generate_image_key(model, style)
        logger.info(f"Uploading to MinIO: {key}")
        image_url = upload_pil_image(final_image, key, format="JPEG", quality=85)
        logger.info(f"Uploaded: {image_url}")

        return {
            "model": model,
            "image_url": image_url,
            "template": template,
            "font": font,
        }
    except Exception as e:
        logger.exception(f"ERROR generating thumbnail: {type(e).__name__}: {e}")
        raise
