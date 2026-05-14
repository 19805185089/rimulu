import thinkingRimuruGif from "../../assets/chat_thinking_rimuru.gif";
import { createBlueStyleProfile, type StyleProfile } from "./template";

export const HATCH_PET_STYLE_PREFIX = "hatch-pet:";

export type InstalledHatchPet = {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  spritesheetUrl: string;
  theme?: {
    primaryColor?: string;
  };
};

export const getHatchPetStyleId = (petId: string) => `${HATCH_PET_STYLE_PREFIX}${petId}`;

export const isHatchPetStyleId = (styleId: string | undefined | null): styleId is string =>
  Boolean(styleId?.startsWith(HATCH_PET_STYLE_PREFIX));

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string | undefined): RgbColor | null => {
  if (!hex) return null;
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToCss = (color: RgbColor, alpha = 1) =>
  `rgba(${Math.round(clamp(color.r))}, ${Math.round(clamp(color.g))}, ${Math.round(clamp(color.b))}, ${alpha})`;

const mix = (color: RgbColor, target: RgbColor, ratio: number): RgbColor => ({
  r: color.r + (target.r - color.r) * ratio,
  g: color.g + (target.g - color.g) * ratio,
  b: color.b + (target.b - color.b) * ratio,
});

const relativeLuminance = ({ r, g, b }: RgbColor) => {
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const readableTextColor = (primary: RgbColor): RgbColor => {
  const base = relativeLuminance(primary) > 0.46 ? mix(primary, { r: 22, g: 28, b: 30 }, 0.72) : mix(primary, { r: 10, g: 19, b: 27 }, 0.5);
  return {
    r: clamp(base.r),
    g: clamp(base.g),
    b: clamp(base.b),
  };
};

const createHatchPetTokens = (primaryHex: string | undefined) => {
  const primary = hexToRgb(primaryHex) ?? { r: 133, g: 178, b: 52 };
  const text = readableTextColor(primary);
  const soft = mix(primary, { r: 255, g: 255, b: 255 }, 0.72);
  const pale = mix(primary, { r: 255, g: 255, b: 255 }, 0.86);
  const deep = mix(primary, { r: 0, g: 0, b: 0 }, 0.18);
  const warm = mix(primary, { r: 255, g: 207, b: 94 }, 0.34);

  return {
    panelBg: rgbToCss(pale, 0.96),
    panelBorder: rgbToCss(soft, 0.88),
    titleText: rgbToCss(text, 1),
    bodyText: rgbToCss(mix(text, { r: 20, g: 24, b: 28 }, 0.08), 0.96),
    mutedText: rgbToCss(mix(text, { r: 255, g: 255, b: 255 }, 0.18), 0.9),
    menuText: rgbToCss(text, 0.96),
    menuBorder: rgbToCss(mix(primary, { r: 255, g: 255, b: 255 }, 0.46), 0.9),
    menuBg: `radial-gradient(circle at 28% 18%, rgba(255, 255, 255, 0.98), ${rgbToCss(pale, 0.95)} 42%, ${rgbToCss(
      soft,
      0.88,
    )} 76%, ${rgbToCss(primary, 0.82)} 100%)`,
    toastBg: `radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 1), ${rgbToCss(pale, 0.96)} 46%, ${rgbToCss(
      soft,
      0.88,
    )} 100%)`,
    toastBorder: rgbToCss(mix(primary, { r: 255, g: 255, b: 255 }, 0.38), 0.92),
    toastText: rgbToCss(text, 1),
    footerBg: rgbToCss(mix(primary, { r: 255, g: 255, b: 255 }, 0.9), 0.96),
    footerBorder: rgbToCss(soft, 0.84),
    expTrackBg: rgbToCss(soft, 0.32),
    expFillFrom: rgbToCss(mix(primary, { r: 255, g: 255, b: 255 }, 0.28), 0.94),
    expFillTo: rgbToCss(deep, 0.95),
    mpTrackBg: rgbToCss(mix(warm, { r: 255, g: 255, b: 255 }, 0.36), 0.32),
    mpFillFrom: rgbToCss(mix(warm, { r: 255, g: 255, b: 255 }, 0.2), 0.94),
    mpFillTo: rgbToCss(mix(warm, { r: 0, g: 0, b: 0 }, 0.14), 0.95),
  };
};

export const createHatchPetStyleProfile = (pet: InstalledHatchPet): StyleProfile => {
  const tokens = createHatchPetTokens(pet.theme?.primaryColor);

  return createBlueStyleProfile({
    id: getHatchPetStyleId(pet.id),
    label: `${pet.displayName}-Hatch Pet`,
    description: pet.description,
    assistantName: pet.displayName,
    mainImage: pet.spritesheetUrl,
    hatchPet: {
      spritesheet: pet.spritesheetUrl,
      displayName: pet.displayName,
      description: pet.description,
      columns: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
    },
    mainImageScale: 1,
    mainGlossOpacity: 0,
    mainGlossBackground: "transparent",
    mainImageFilter: "none",
    mainButtonFilter:
      `drop-shadow(0 10px 18px ${tokens.menuBorder}) drop-shadow(0 0 1px rgba(255, 255, 255, 0.72))`,
    mainButtonHoverFilter:
      `drop-shadow(0 14px 24px ${tokens.menuBorder}) drop-shadow(0 0 1px rgba(255, 255, 255, 0.86))`,
    mainIdleAnimation: "idle-breathe 2.1s ease-in-out infinite",
    mainImageIdleAnimation: "none",
    mainGlossAnimation: "none",
    thinkingGif: thinkingRimuruGif,
    defaultSystemPrompt: `你是 ${pet.displayName}，一个温和、可靠、陪伴感很强的桌宠助手。语气亲切、简短、可靠；先用轻松友好的口吻回应，再给准确实用的信息。复杂问题先确认目标和约束。`,
    tokens,
  });
};
