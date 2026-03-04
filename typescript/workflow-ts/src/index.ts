/**
 * Blog Thumbnail Generator Workflow Tasks
 *
 * Defines Render Workflow tasks for distributed thumbnail generation.
 * Each task runs in its own compute instance and can spawn other tasks.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { task } from "@renderinc/sdk/workflows";
import dotenv from "dotenv";
import { generateThumbnailImage } from "./generator.js";
import type { Font, GenerationResult, Style, Template } from "./types.js";

// Load .env.local from repo root (local dev only)
if (process.env.NODE_ENV !== "production") {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
}

// Re-export for API to import (for LOCAL_MODE)
export { generateThumbnailImage } from "./generator.js";
export * from "./types.js";

/**
 * Subtask: generates a single thumbnail for one model.
 * Called by generateThumbnails as a distributed subtask.
 */
const generateThumbnail = task(
  {
    name: "generateThumbnail",
    retry: {
      maxRetries: 2,
      waitDurationMs: 5000,
      backoffScaling: 2,
    },
  },
  async (
    title: string,
    model: string,
    style: string,
    template: string,
    font: string,
    context: string,
    extraPrompt: string,
  ): Promise<GenerationResult> => {
    console.log(`[generateThumbnail] model=${model}`);

    const result = await generateThumbnailImage(
      title,
      model,
      style as Style,
      template as Template,
      font as Font,
      context,
      extraPrompt,
    );

    console.log(`[generateThumbnail] done model=${model}, url=${result.image_url}`);
    return result;
  },
);

/**
 * Main task: spawns subtasks for each model in parallel.
 */
const _generateThumbnails = task(
  { name: "generateThumbnails" },
  async (
    title: string,
    models: string[],
    style: string,
    template: string,
    font: string,
    context: string,
    extraPrompt: string,
  ) => {
    console.log(`[generateThumbnails] starting with ${models.length} models: ${models.join(", ")}`);

    const results: GenerationResult[] = [];
    const failures: Array<{ model: string; error: string }> = [];

    await Promise.all(
      models.map(async (model) => {
        try {
          const result = await generateThumbnail(
            title, model, style, template, font, context, extraPrompt,
          );
          results.push(result);
        } catch (e: unknown) {
          failures.push({
            model,
            error: e instanceof Error ? e.message : "Unknown error",
          });
        }
      }),
    );

    console.log(
      `[generateThumbnails] done: ${results.length} succeeded, ${failures.length} failed`,
    );

    if (results.length === 0 && failures.length > 0) {
      const summary = failures.map((f) => `${f.model}: ${f.error}`).join("; ");
      throw new Error(`All models failed: ${summary}`);
    }

    return { title, style, template, font, results, failures };
  },
);

