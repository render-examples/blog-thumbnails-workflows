import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Font, FontConfig, Style } from "./types.js";

// Resolve shared config directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sharedDir = path.resolve(__dirname, "../../../shared");

// Load shared configs
const canvasConfig = JSON.parse(fs.readFileSync(path.join(sharedDir, "canvas.json"), "utf-8"));
const stylesConfig = JSON.parse(fs.readFileSync(path.join(sharedDir, "styles.json"), "utf-8"));
const fontsConfig = JSON.parse(fs.readFileSync(path.join(sharedDir, "fonts.json"), "utf-8"));

export const CANVAS_WIDTH: number = canvasConfig.width;
export const CANVAS_HEIGHT: number = canvasConfig.height;
export const STYLE_DESCRIPTIONS: Record<Style, string> = stylesConfig;
export const FONT_CONFIG: Record<Font, FontConfig> = fontsConfig;
