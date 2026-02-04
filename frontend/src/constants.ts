import type { FontOption, Option } from "./types";

import fontsConfig from "../../shared/fonts.json";
import modelsConfig from "../../shared/models.json";
// Import shared config (single source of truth)
import stylesConfig from "../../shared/styles.json";
import templatesConfig from "../../shared/templates.json";

// Build model options from shared config
export const MODEL_OPTIONS: Option[] = Object.entries(
  modelsConfig as Record<string, { name: string; provider: string }>
).map(([id, config]) => ({
  id,
  label: config.name,
}));

// Build style options from shared config
// Format: { "styleid": "Style description for AI prompt" }
const STYLE_LABELS: Record<string, string> = {
  photorealistic: "Photorealistic",
  cinematic: "Cinematic",
  cartoon: "Cartoon",
  anime: "Anime",
  "3d": "3D Render",
  "pixel-art": "Pixel Art",
  watercolor: "Watercolor",
  "oil-painting": "Oil Painting",
  sketch: "Sketch",
  minimalist: "Minimalist",
  neon: "Neon / Cyberpunk",
  vintage: "Vintage / Retro",
};

export const STYLE_OPTIONS: Option[] = Object.keys(stylesConfig).map((id) => ({
  id,
  label: STYLE_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " "),
}));

// Build template options from shared config
// Format: { "templateid": { "label": "...", "description": "..." } }
export const TEMPLATE_OPTIONS: Option[] = Object.entries(
  templatesConfig as Record<string, { label: string; description: string }>
).map(([id, config]) => ({
  id,
  label: config.label,
}));

// Build font options from shared config
// Format: { "fontid": { "name": "...", "fallback": "...", "url": "..." } }
export const FONT_OPTIONS: FontOption[] = Object.entries(
  fontsConfig as Record<string, { name: string; fallback: string; url: string }>
).map(([id, config]) => ({
  id,
  label: config.name,
  fontFamily: `'${config.name}', ${config.fallback}`,
}));
