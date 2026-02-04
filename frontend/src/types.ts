export type Style =
  | "photorealistic"
  | "cartoon"
  | "3d"
  | "watercolor"
  | "oil-painting"
  | "sketch"
  | "minimalist"
  | "cinematic"
  | "anime"
  | "pixel-art"
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
  | "jetbrains-mono";

export type Option = { id: string; label: string };
export type FontOption = Option & { fontFamily: string };

export type GenerationResult = {
  model: string;
  image_url: string;
};
