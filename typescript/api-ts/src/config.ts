import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Configuration and environment variables for the Blog Thumbnail API.
 */
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local from repo root (local dev only)
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
}

// Load shared config (single source of truth)
const sharedDir = resolve(__dirname, "../../../shared");
const stylesConfig = JSON.parse(readFileSync(resolve(sharedDir, "styles.json"), "utf-8"));
const templatesConfig = JSON.parse(readFileSync(resolve(sharedDir, "templates.json"), "utf-8"));
const fontsConfig = JSON.parse(readFileSync(resolve(sharedDir, "fonts.json"), "utf-8"));

// Build validation arrays from shared config
const VALID_STYLES = Object.keys(stylesConfig) as [string, ...string[]];
const VALID_TEMPLATES = Object.keys(templatesConfig) as [string, ...string[]];
const VALID_FONTS = Object.keys(fontsConfig) as [string, ...string[]];

// Input validation schemas (using shared config)
export const GenerateSchema = z.object({
  title: z.string().min(3).max(200),
  model: z.string().optional(),
  models: z.array(z.string()).max(5).optional(),
  style: z.enum(VALID_STYLES).optional(),
  template: z.enum(VALID_TEMPLATES).optional(),
  font: z.enum(VALID_FONTS).optional(),
  blogUrl: z.string().url().optional().or(z.literal("")),
  extraPrompt: z.string().max(500).optional(),
});

export type GenerateBody = z.infer<typeof GenerateSchema>;

// Constants
export const MAX_CONTEXT_CHARS = 2500;

// Environment variables
export const renderApiKey = process.env.RENDER_API_KEY || "";
export const workflowSlug = process.env.WORKFLOW_SLUG || "";
export const workflowId = process.env.WORKFLOW_ID || "";
export const localMode = process.env.LOCAL_MODE === "true";
export const demoMode = process.env.DEMO_MODE === "true";
export const enableModeration = process.env.ENABLE_MODERATION === "true";

// MinIO config
export const minioConfig = {
  endpoint: process.env.MINIO_ENDPOINT || "",
  accessKey: process.env.MINIO_ACCESS_KEY || "",
  secretKey: process.env.MINIO_SECRET_KEY || "",
  bucket: process.env.MINIO_BUCKET || "thumbnails",
  publicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL || "",
};
