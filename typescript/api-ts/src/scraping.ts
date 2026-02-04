/**
 * Blog scraping utilities for fetching context and metadata.
 */
import * as cheerio from "cheerio";
import { MAX_CONTEXT_CHARS } from "./config.js";

/** Clean and truncate text content. */
const cleanText = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT_CHARS);

/** Fetch and extract text content from a blog URL. */
export async function fetchBlogContext(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    return cleanText($.text());
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch the title from a blog URL (tries og:title, twitter:title, then <title>). */
export async function fetchBlogTitle(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr("content");
    if (ogTitle) {
      return cleanText(ogTitle);
    }
    const twitterTitle = $('meta[name="twitter:title"]').attr("content");
    if (twitterTitle) {
      return cleanText(twitterTitle);
    }
    const title = $("title").first().text();
    return cleanText(title || "");
  } finally {
    clearTimeout(timeout);
  }
}
