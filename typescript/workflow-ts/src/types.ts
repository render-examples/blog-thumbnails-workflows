export type Style =
  | "photorealistic"
  | "cinematic"
  | "cartoon"
  | "anime"
  | "3d"
  | "pixel-art"
  | "watercolor"
  | "oil-painting"
  | "sketch"
  | "minimalist"
  | "neon"
  | "vintage";

export type Template =
  | "bottom-bar"
  | "left-panel"
  | "center-box"
  | "overlay-bottom"
  | "overlay-center";

export type Font =
  | "inter"
  | "roboto"
  | "poppins"
  | "montserrat"
  | "raleway"
  | "oswald"
  | "bebas-neue"
  | "playfair"
  | "merriweather"
  | "lora"
  | "space-mono"
  | "jetbrains-mono"
  | "bangers"
  | "pacifico"
  | "permanent-marker"
  | "righteous"
  | "creepster"
  | "press-start-2p";

export interface FontConfig {
  name: string;
  fallback: string;
  url: string;
}

export interface GenerationResult {
  model: string;
  image_url: string;
  template: Template;
  font: Font;
}
