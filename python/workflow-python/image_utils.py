"""Image utilities for resizing and text overlays."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Load shared config
SHARED_DIR = Path(__file__).parent.parent.parent / "shared"
_canvas_config = json.loads((SHARED_DIR / "canvas.json").read_text())
_fonts_config: dict = json.loads((SHARED_DIR / "fonts.json").read_text())

CANVAS_WIDTH: int = _canvas_config["width"]
CANVAS_HEIGHT: int = _canvas_config["height"]

# Font cache: font_family -> path to downloaded TTF
_font_cache: dict[str, str] = {}


def _download_font(font_family: str) -> str | None:
    """Download font from URL and cache it. Returns path to TTF file."""
    if font_family in _font_cache:
        return _font_cache[font_family]

    config = _fonts_config.get(font_family)
    if not config or not config.get("url"):
        print(f"No URL for font: {font_family}")
        return None

    url = config["url"]
    try:
        print(f"Downloading font: {font_family} from {url}")
        response = httpx.get(url, follow_redirects=True, timeout=30)
        response.raise_for_status()

        # Save to temp file
        suffix = ".ttf" if ".ttf" in url.lower() else ".otf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            f.write(response.content)
            path = f.name

        print(f"Font {font_family} downloaded to {path}")
        _font_cache[font_family] = path
        return path
    except Exception as e:
        print(f"Failed to download font {font_family}: {e}")
        return None


def resize_and_crop(
    image: Image.Image, width: int = CANVAS_WIDTH, height: int = CANVAS_HEIGHT
) -> Image.Image:
    img_aspect = image.width / image.height
    target_aspect = width / height

    if img_aspect > target_aspect:
        new_height = height
        new_width = int(image.width * (new_height / image.height))
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        left = (new_width - width) // 2
        image = image.crop((left, 0, left + width, height))
    else:
        new_width = width
        new_height = int(image.height * (new_width / image.width))
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        top = (new_height - height) // 2
        image = image.crop((0, top, width, top + height))

    return image


def _load_font(font_family: str, size: int) -> ImageFont.FreeTypeFont:
    """Load font from shared config URL, download if needed."""
    path = _download_font(font_family)
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception as e:
            print(f"Failed to load font {font_family}: {e}")
    return ImageFont.load_default()


def _wrap_text(
    draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int
) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []

    for word in words:
        test = " ".join(current + [word])
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def _calculate_optimal_font_size(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_family: str,
    max_width: int,
    max_height: int,
    max_lines: int = 4,
) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """Find optimal font size that fills available space."""
    max_font_size = 80
    min_font_size = 32

    for size in range(max_font_size, min_font_size - 1, -2):
        font = _load_font(font_family, size)
        lines = _wrap_text(draw, text, font, max_width)
        line_height = size * 1.25
        total_height = len(lines) * line_height

        # Check if text fits within constraints
        if len(lines) <= max_lines and total_height <= max_height:
            # Verify no single line exceeds max_width
            all_fit = True
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                if bbox[2] - bbox[0] > max_width:
                    all_fit = False
                    break
            if all_fit:
                print(f"[overlay] Dynamic sizing: fontSize={size}, lines={len(lines)}")
                return font, lines

    # Fallback to minimum size
    font = _load_font(font_family, min_font_size)
    lines = _wrap_text(draw, text, font, max_width)
    return font, lines


def _draw_text_block(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.FreeTypeFont,
    box: tuple[int, int, int, int],
    align: str = "left",
) -> None:
    left, top, right, bottom = box
    line_height = font.size * 1.25
    text_height = line_height * len(lines)
    y = top + (bottom - top - text_height) / 2

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        if align == "center":
            x = left + (right - left - text_width) / 2
        else:
            x = left
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
        y += line_height


def _draw_text_with_shadow(
    overlay: Image.Image,
    lines: list[str],
    font: ImageFont.FreeTypeFont,
    box: tuple[int, int, int, int],
    align: str = "left",
) -> None:
    """Draw text with two-layer shadow: soft offset + visibility glow."""
    left, top, right, bottom = box
    line_height = font.size * 1.25
    text_height = line_height * len(lines)
    start_y = top + (bottom - top - text_height) / 2

    def draw_text_on_layer(
        layer: Image.Image, offset_x: float, offset_y: float, color: tuple
    ) -> None:
        draw = ImageDraw.Draw(layer)
        y = start_y
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            text_width = bbox[2] - bbox[0]
            if align == "center":
                x = left + (right - left - text_width) / 2
            else:
                x = left
            draw.text((x + offset_x, y + offset_y), line, font=font, fill=color)
            y += line_height

    # Layer 1: Offset shadow (for depth)
    shadow_layer = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    draw_text_on_layer(shadow_layer, 5, 5, (0, 0, 0, 150))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=4))
    overlay.paste(shadow_layer, (0, 0), shadow_layer)

    # Layer 2: Glow (for visibility)
    glow_layer = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    draw_text_on_layer(glow_layer, 0, 0, (0, 0, 0, 180))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=6))
    overlay.paste(glow_layer, (0, 0), glow_layer)

    # Main text on top
    draw_text_on_layer(overlay, 0, 0, (255, 255, 255, 255))


def apply_template(image: Image.Image, title: str, template: str, font_family: str) -> Image.Image:
    image = image.convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    if template == "left-panel":
        panel_width = int(CANVAS_WIDTH * 0.42)
        box = (0, 0, panel_width, CANVAS_HEIGHT)
        draw.rectangle(box, fill=(0, 0, 0, 200))
        text_box = (40, 40, panel_width - 40, CANVAS_HEIGHT - 40)
        max_width = panel_width - 80
        max_height = CANVAS_HEIGHT - 80
        font, lines = _calculate_optimal_font_size(
            draw, title, font_family, max_width, max_height, max_lines=5
        )
        _draw_text_block(draw, lines, font, text_box)
    elif template == "center-box":
        box_width = int(CANVAS_WIDTH * 0.75)
        box_height = int(CANVAS_HEIGHT * 0.55)
        left = (CANVAS_WIDTH - box_width) // 2
        top = (CANVAS_HEIGHT - box_height) // 2
        box = (left, top, left + box_width, top + box_height)
        draw.rectangle(box, fill=(0, 0, 0, 200))
        text_box = (left + 50, top + 50, left + box_width - 50, top + box_height - 50)
        max_width = box_width - 100
        max_height = box_height - 100
        font, lines = _calculate_optimal_font_size(
            draw, title, font_family, max_width, max_height, max_lines=4
        )
        _draw_text_block(draw, lines, font, text_box, align="center")
    elif template == "overlay-bottom":
        # No background, text at bottom with drop shadow
        text_box = (60, CANVAS_HEIGHT - 200, CANVAS_WIDTH - 60, CANVAS_HEIGHT - 40)
        max_width = CANVAS_WIDTH - 120
        max_height = 160
        font, lines = _calculate_optimal_font_size(
            draw, title, font_family, max_width, max_height, max_lines=2
        )
        _draw_text_with_shadow(overlay, lines, font, text_box)
    elif template == "overlay-center":
        # No background, centered text with drop shadow
        box_width = int(CANVAS_WIDTH * 0.85)
        box_height = int(CANVAS_HEIGHT * 0.5)
        left = (CANVAS_WIDTH - box_width) // 2
        top = (CANVAS_HEIGHT - box_height) // 2
        text_box = (left, top, left + box_width, top + box_height)
        max_width = box_width
        max_height = box_height
        font, lines = _calculate_optimal_font_size(
            draw, title, font_family, max_width, max_height, max_lines=3
        )
        _draw_text_with_shadow(overlay, lines, font, text_box, align="center")
    else:
        # bottom-bar (default)
        bar_height = int(CANVAS_HEIGHT * 0.32)
        box = (0, CANVAS_HEIGHT - bar_height, CANVAS_WIDTH, CANVAS_HEIGHT)
        draw.rectangle(box, fill=(0, 0, 0, 200))
        text_box = (60, CANVAS_HEIGHT - bar_height + 30, CANVAS_WIDTH - 60, CANVAS_HEIGHT - 30)
        max_width = CANVAS_WIDTH - 120
        max_height = bar_height - 60
        font, lines = _calculate_optimal_font_size(
            draw, title, font_family, max_width, max_height, max_lines=3
        )
        _draw_text_block(draw, lines, font, text_box)

    return Image.alpha_composite(image, overlay).convert("RGB")
