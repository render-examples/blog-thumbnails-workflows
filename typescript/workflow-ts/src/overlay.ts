import type { Font as OpenTypeFont } from "opentype.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config.js";
import { getFont } from "./fonts.js";
import type { Font, Template } from "./types.js";

interface TextLayout {
  lines: string[];
  fontSize: number;
}

/**
 * Wrap text to fit within maxWidth using actual font measurements.
 * Returns lines that fit within the width constraint.
 */
function wrapTextByWidth(
  text: string,
  font: OpenTypeFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine: string[] = [];

  for (const word of words) {
    const testLine = [...currentLine, word].join(" ");
    const testWidth = font.getAdvanceWidth(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine.push(word);
    } else {
      if (currentLine.length) {
        lines.push(currentLine.join(" "));
      }
      currentLine = [word];
    }
  }
  if (currentLine.length) {
    lines.push(currentLine.join(" "));
  }
  return lines;
}

/**
 * Find optimal font size that fills available space.
 * Tries larger sizes first and scales down until text fits.
 */
function calculateOptimalLayout(
  text: string,
  font: OpenTypeFont,
  maxWidth: number,
  maxHeight: number,
  maxLines = 4,
): TextLayout {
  // Start with a large font size and work down
  const maxFontSize = 80;
  const minFontSize = 32;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lineHeight = Math.floor(fontSize * 1.25);
    const lines = wrapTextByWidth(text, font, fontSize, maxWidth);
    const totalHeight = lines.length * lineHeight;

    // Check if text fits within constraints
    if (lines.length <= maxLines && totalHeight <= maxHeight) {
      // Also verify no single line exceeds maxWidth (for long words)
      const allLinesFit = lines.every((line) => font.getAdvanceWidth(line, fontSize) <= maxWidth);
      if (allLinesFit) {
        return { lines, fontSize };
      }
    }
  }

  // Fallback to minimum size
  const lines = wrapTextByWidth(text, font, minFontSize, maxWidth);
  return { lines, fontSize: minFontSize };
}

/**
 * Fallback character-based wrapping when font isn't available.
 */
function wrapTextByChars(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const test = [...current, word].join(" ");
    if (test.length <= maxChars) {
      current.push(word);
    } else {
      if (current.length) lines.push(current.join(" "));
      current = [word];
    }
  }
  if (current.length) lines.push(current.join(" "));
  return lines;
}

export async function buildSvgOverlay(
  title: string,
  template: Template,
  font: Font,
): Promise<string> {
  const parsedFont = await getFont(font);
  let rect = "";
  let textBox = { x: 60, y: 60, width: CANVAS_WIDTH - 120, height: CANVAS_HEIGHT - 120 };
  let maxLines = 3;
  let fallbackMaxChars = 28;
  let fallbackFontSize = 56;
  let useDropShadow = false;
  let textAlign: "left" | "center" = "left";

  if (template === "left-panel") {
    const panelWidth = Math.floor(CANVAS_WIDTH * 0.42);
    rect = `<rect x="0" y="0" width="${panelWidth}" height="${CANVAS_HEIGHT}" fill="rgba(0,0,0,0.78)" />`;
    textBox = { x: 40, y: 40, width: panelWidth - 80, height: CANVAS_HEIGHT - 80 };
    maxLines = 5;
    fallbackMaxChars = 18;
    fallbackFontSize = 48;
  } else if (template === "center-box") {
    const boxWidth = Math.floor(CANVAS_WIDTH * 0.75);
    const boxHeight = Math.floor(CANVAS_HEIGHT * 0.55);
    const left = Math.floor((CANVAS_WIDTH - boxWidth) / 2);
    const top = Math.floor((CANVAS_HEIGHT - boxHeight) / 2);
    rect = `<rect x="${left}" y="${top}" width="${boxWidth}" height="${boxHeight}" fill="rgba(0,0,0,0.78)" />`;
    textBox = { x: left + 50, y: top + 50, width: boxWidth - 100, height: boxHeight - 100 };
    maxLines = 4;
    fallbackMaxChars = 30;
    fallbackFontSize = 48;
    textAlign = "center";
  } else if (template === "overlay-bottom") {
    // No background, text at bottom with drop shadow
    textBox = {
      x: 60,
      y: CANVAS_HEIGHT - 200,
      width: CANVAS_WIDTH - 120,
      height: 160,
    };
    maxLines = 2;
    fallbackMaxChars = 35;
    fallbackFontSize = 60;
    useDropShadow = true;
  } else if (template === "overlay-center") {
    // No background, centered text with drop shadow
    const boxWidth = Math.floor(CANVAS_WIDTH * 0.85);
    const boxHeight = Math.floor(CANVAS_HEIGHT * 0.5);
    const left = Math.floor((CANVAS_WIDTH - boxWidth) / 2);
    const top = Math.floor((CANVAS_HEIGHT - boxHeight) / 2);
    textBox = { x: left, y: top, width: boxWidth, height: boxHeight };
    maxLines = 3;
    fallbackMaxChars = 35;
    fallbackFontSize = 64;
    useDropShadow = true;
    textAlign = "center";
  } else {
    // bottom-bar (default)
    const barHeight = Math.floor(CANVAS_HEIGHT * 0.32);
    rect = `<rect x="0" y="${CANVAS_HEIGHT - barHeight}" width="${CANVAS_WIDTH}" height="${barHeight}" fill="rgba(0,0,0,0.78)" />`;
    textBox = {
      x: 60,
      y: CANVAS_HEIGHT - barHeight + 30,
      width: CANVAS_WIDTH - 120,
      height: barHeight - 60,
    };
    maxLines = 3;
    fallbackMaxChars = 30;
    fallbackFontSize = 54;
  }

  // Calculate optimal layout using font metrics if available
  let lines: string[];
  let fontSize: number;

  if (parsedFont) {
    const layout = calculateOptimalLayout(
      title,
      parsedFont,
      textBox.width,
      textBox.height,
      maxLines,
    );
    lines = layout.lines;
    fontSize = layout.fontSize;
    console.log(`[overlay] Dynamic sizing: fontSize=${fontSize}, lines=${lines.length}`);
  } else {
    lines = wrapTextByChars(title, fallbackMaxChars);
    fontSize = fallbackFontSize;
  }

  const lineHeight = Math.floor(fontSize * 1.25);
  const textHeight = lineHeight * lines.length;
  const startY = textBox.y + Math.floor((textBox.height - textHeight) / 2) + fontSize;

  // Build text paths using opentype.js
  let textPaths = "";

  if (parsedFont) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = startY + i * lineHeight;

      // Calculate x position based on template alignment
      let x = textBox.x;
      if (textAlign === "center") {
        const textWidth = parsedFont.getAdvanceWidth(line, fontSize);
        x = textBox.x + Math.floor((textBox.width - textWidth) / 2);
      }

      const path = parsedFont.getPath(line, x, y, fontSize);
      textPaths += path.toSVG(2);
    }
  } else {
    // Fallback to basic text if font failed to load
    const centerX = textAlign === "center" ? textBox.x + Math.floor(textBox.width / 2) : textBox.x;
    const textAnchor = textAlign === "center" ? "middle" : "start";
    const textSpans = lines
      .map((line) => `<tspan x="${centerX}" dy="${lineHeight}">${line}</tspan>`)
      .join("");
    textPaths = `<text x="${centerX}" y="${startY - fontSize}" fill="white" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="${textAnchor}">${textSpans}</text>`;
  }

  // Two-layer shadow: soft offset shadow + visibility glow
  const shadowFilter = useDropShadow
    ? `
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="4" dy="4" stdDeviation="4" flood-color="black" flood-opacity="0.6"/>
        <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="black" flood-opacity="0.7"/>
      </filter>
    </defs>
  `
    : "";

  const textFilter = useDropShadow ? 'filter="url(#shadow)"' : "";

  return `
    <svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${shadowFilter}
      ${rect}
      <g fill="white" ${textFilter}>${textPaths}</g>
    </svg>
  `;
}
