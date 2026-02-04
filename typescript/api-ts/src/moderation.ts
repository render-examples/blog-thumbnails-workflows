import OpenAI from "openai";
import { enableModeration } from "./config.js";

type ModerationResult = { flagged: false } | { flagged: true; reason: string };

let _openai: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Check texts against OpenAI's Moderation API.
 * Only runs when ENABLE_MODERATION=true and OPENAI_API_KEY is set.
 */
export async function moderateContent(texts: string[]): Promise<ModerationResult> {
  if (!enableModeration) return { flagged: false };

  const client = getClient();
  if (!client || texts.length === 0) return { flagged: false };

  try {
    const response = await client.moderations.create({ input: texts });
    const hit = response.results.find((r) => r.flagged);
    if (!hit) return { flagged: false };

    const categories = Object.entries(hit.categories)
      .filter(([, v]) => v)
      .map(([k]) => k.replace("/", " / "));

    return {
      flagged: true,
      reason: `Your prompt was flagged for inappropriate content (${categories.join(", ")}). Please revise and try again.`,
    };
  } catch (err) {
    console.error("[moderation] OpenAI moderation check failed:", err);
    return { flagged: false };
  }
}
