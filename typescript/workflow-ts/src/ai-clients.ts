import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { STYLE_DESCRIPTIONS } from "./config.js";
import type { Style } from "./types.js";

// Lazy-loaded clients (env vars must be loaded before first use)
let _openai: OpenAI | null = null;
let _google: GoogleGenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

function getGoogle(): GoogleGenAI {
  if (!_google) {
    _google = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
  }
  return _google;
}

export function buildPrompt(title: string, style: Style, context: string, extra: string): string {
  const desc = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS.photorealistic;
  let prompt = `${desc}. Create a wide image for a blog post titled '${title}'.`;
  if (context) prompt += ` Context: ${context}`;
  if (extra) prompt += ` Additional guidelines: ${extra}`;
  prompt += " No text, letters, or words in the image. No logos or watermarks.";
  return prompt;
}

export async function generateOpenAIImage(model: string, prompt: string): Promise<Buffer> {
  // GPT Image models return base64 and use output_format (not response_format).
  const result = await getOpenAI().images.generate({
    model,
    prompt,
    size: "1536x1024", // landscape for blog thumbnails
    output_format: "jpeg",
    output_compression: 85,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image response did not include image data");
  }
  return Buffer.from(b64, "base64");
}

export async function generateGeminiImage(prompt: string): Promise<Buffer> {
  const response = await getGoogle().models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
  });
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("Gemini response did not include image data");
}
