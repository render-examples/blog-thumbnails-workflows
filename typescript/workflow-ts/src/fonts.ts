import opentype from "opentype.js";
import { FONT_CONFIG } from "./config.js";
import type { Font } from "./types.js";

// Font cache to store parsed opentype.Font objects
const fontCache = new Map<Font, opentype.Font>();

export async function getFont(font: Font): Promise<opentype.Font | null> {
  const cached = fontCache.get(font);
  if (cached) {
    return cached;
  }

  const config = FONT_CONFIG[font];
  if (!config) {
    console.warn(`Unknown font: ${font}`);
    return null;
  }

  try {
    console.log(`Fetching font: ${font} from ${config.url}`);
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const parsedFont = opentype.parse(buffer);
    console.log(`Font ${font} loaded and parsed`);
    fontCache.set(font, parsedFont);
    return parsedFont;
  } catch (err) {
    console.warn(`Failed to fetch/parse font ${font}:`, err);
    return null;
  }
}
