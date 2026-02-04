import { Render } from "@renderinc/sdk";
import cors from "cors";
/**
 * Blog Thumbnail API (TypeScript)
 * Entry point: server setup, middleware, and routes.
 */
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import {
  type GenerateBody,
  GenerateSchema,
  demoMode,
  localMode,
  renderApiKey,
  workflowSlug,
} from "./config.js";
import { moderateContent } from "./moderation.js";
import { fetchBlogContext, fetchBlogTitle } from "./scraping.js";

const render = new Render({ token: renderApiKey });

import { deleteImage, ensureBucket, getS3Client, listImages } from "./storage.js";
import { extractErrorMessage, logFullError, toSdkErrorResponse } from "./utils.js";

const app = express();

// Trust proxy for Render's load balancer (needed for rate limiting)
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Rate limiting
const createLimiter = (max: number, windowMs = 60 * 1000) =>
  rateLimit({
    windowMs,
    max,
    message: { error: "Too many requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });

const generateLimiter = createLimiter(
  demoMode ? 2 : 10,
  demoMode ? 60 * 60 * 1000 : 60 * 1000,
);
const generalLimiter = createLimiter(100);

app.use(generalLimiter);

/** Normalize model selection from request body. */
function normalizeModels(body: GenerateBody): string[] {
  if (body.models && body.models.length > 0) {
    return body.models;
  }
  if (body.model) {
    return [body.model];
  }
  return ["gemini-3-pro-image-preview"];
}

/** GET /health - Health check. */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: localMode ? "local" : "remote" });
});

/** GET /api/metadata - Fetch blog title from URL. */
app.get("/api/metadata", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : "";
  if (!url) {
    return res.status(400).json({ error: "url query param is required" });
  }
  try {
    const title = await fetchBlogTitle(url);
    return res.json({ title });
  } catch (error) {
    console.error("[API] Metadata error:", error);
    return res.status(500).json({ error: "Failed to fetch blog metadata" });
  }
});

/** POST /api/generate - Start thumbnail generation task. */
app.post("/api/generate", generateLimiter, async (req, res) => {
  const parseResult = GenerateSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return res.status(400).json({
      error: `${firstError.path.join(".")}: ${firstError.message}`,
    });
  }
  const body = parseResult.data;
  const models = normalizeModels(body);

  // Fetch blog context if URL provided
  let blogContext = "";
  if (body.blogUrl) {
    try {
      blogContext = await fetchBlogContext(body.blogUrl);
    } catch (e) {
      console.warn("[API] Failed to fetch blog context:", e);
    }
  }

  // Content moderation (runs unconditionally when OPENAI_API_KEY is set)
  const textsToModerate = [body.title, body.extraPrompt].filter(Boolean) as string[];
  const moderation = await moderateContent(textsToModerate);
  if (moderation.flagged) {
    return res.status(400).json({ error: moderation.reason });
  }

  // Local mode: import workflow and run directly
  if (localMode) {
    try {
      // Dynamic import - can't type-check cross-package imports
      type WorkflowModule = { generateThumbnailImage: (...args: unknown[]) => Promise<unknown> };
      const workflow = await (Function(
        'return import("../../workflow-ts/src/index.js")',
      )() as Promise<WorkflowModule>);

      const style = body.style || "photorealistic";
      const template = body.template || "bottom-bar";
      const font = body.font || "inter";

      const results = await Promise.all(
        models.map((model: string) =>
          workflow.generateThumbnailImage(
            body.title,
            model,
            style,
            template,
            font,
            blogContext,
            body.extraPrompt || "",
          ),
        ),
      );

      return res.json({
        task_id: "local",
        status: "completed",
        results: { title: body.title, style, template, font, results },
      });
    } catch (error: unknown) {
      console.error("Local generate error:", error);
      const message = extractErrorMessage(error);
      return res.status(500).json({ error: message });
    }
  }

  // Remote mode: start task via REST API
  const taskSlug = `${workflowSlug}/generateThumbnails`;
  const taskInput = [
    body.title,
    models,
    body.style || "photorealistic",
    body.template || "bottom-bar",
    body.font || "inter",
    blogContext,
    body.extraPrompt || "",
  ];

  try {
    console.log(`[API] Starting task: ${taskSlug}`);
    const result = await render.workflows.runTask(taskSlug, taskInput);
    console.log(`[API] Task completed: ${result.id}, status: ${result.status}`);
    console.log(`[API] Result structure:`, JSON.stringify(result.results, null, 2).slice(0, 500));
    return res.json({
      task_id: result.id,
      status: result.status,
      results: result.results,
    });
  } catch (error: unknown) {
    logFullError("Generate error", error);
    const { status, message } = toSdkErrorResponse(error);
    return res.status(status).json({ error: message });
  }
});

/** GET /api/gallery - List all images in the gallery. */
app.get("/api/gallery", async (_, res) => {
  const s3 = getS3Client();
  if (!s3) {
    return res.status(503).json({ error: "MinIO not configured" });
  }

  try {
    await ensureBucket(s3);
    const images = await listImages(s3);
    return res.json({ images, total: images.length });
  } catch (error: unknown) {
    console.error("[API] Gallery error:", error);
    return res.status(500).json({ error: extractErrorMessage(error) });
  }
});

/** DELETE /api/gallery - Delete an image from the gallery. */
app.delete("/api/gallery", async (req, res) => {
  if (demoMode) {
    return res.status(403).json({ error: "Deleting images is disabled on the demo instance" });
  }

  const s3 = getS3Client();
  if (!s3) {
    return res.status(503).json({ error: "MinIO not configured" });
  }

  const key = typeof req.query.key === "string" ? req.query.key : "";
  if (!key) {
    return res.status(400).json({ error: "key query param is required" });
  }

  try {
    await deleteImage(s3, key);
    return res.json({ success: true, key });
  } catch (error: unknown) {
    console.error("[API] Delete error:", error);
    return res.status(500).json({ error: extractErrorMessage(error) });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`TS API listening on ${port} (${localMode ? "LOCAL MODE" : "remote mode"})`);
});
