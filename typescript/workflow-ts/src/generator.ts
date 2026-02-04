import sharp from "sharp";
import { buildPrompt, generateGeminiImage, generateOpenAIImage } from "./ai-clients.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config.js";
import { buildSvgOverlay } from "./overlay.js";
import { generateImageKey, uploadImage } from "./storage.js";
import type { Font, GenerationResult, Style, Template } from "./types.js";

export async function generateThumbnailImage(
  title: string,
  model: string,
  style: Style,
  template: Template,
  font: Font,
  context: string,
  extraPrompt: string,
): Promise<GenerationResult> {
  console.log(`[generateThumbnailImage] Starting for model: ${model}`);

  const prompt = buildPrompt(title, style, context, extraPrompt);
  console.log(`[generateThumbnailImage] Prompt built, calling AI...`);

  const imageBuffer = model.startsWith("gemini")
    ? await generateGeminiImage(prompt)
    : await generateOpenAIImage(model, prompt);
  console.log(`[generateThumbnailImage] AI image received (${imageBuffer.length} bytes)`);

  const resized = await sharp(imageBuffer)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();
  console.log(`[generateThumbnailImage] Image resized`);

  const overlay = Buffer.from(await buildSvgOverlay(title, template, font));
  console.log(`[generateThumbnailImage] Overlay built`);

  const composited = await sharp(resized)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();

  console.log(`[generateThumbnailImage] Image composited (${composited.length} bytes)`);

  // Upload to MinIO and return URL
  const key = generateImageKey(model, style);
  console.log(`[generateThumbnailImage] Uploading to MinIO: ${key}`);
  const imageUrl = await uploadImage(composited, key, "image/jpeg");
  console.log(`[generateThumbnailImage] Uploaded: ${imageUrl}`);

  return {
    model,
    image_url: imageUrl,
    template,
    font,
  };
}
