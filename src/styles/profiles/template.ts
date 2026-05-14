import type { PetState } from "../../types/app";

export type StyleTokens = {
  panelBg: string;
  panelBorder: string;
  titleText: string;
  bodyText: string;
  mutedText: string;
  menuText: string;
  menuBorder: string;
  menuBg: string;
  toastBg: string;
  toastBorder: string;
  toastText: string;
  footerBg: string;
  footerBorder: string;
  expTrackBg: string;
  expFillFrom: string;
  expFillTo: string;
  mpTrackBg: string;
  mpFillFrom: string;
  mpFillTo: string;
};

export type HatchPetAnimation = {
  row: number;
  frames?: number;
  durations?: number[];
};

export type HatchPetConfig = {
  spritesheet: string;
  displayName: string;
  description: string;
  columns?: number;
  rows?: number;
  cellWidth?: number;
  cellHeight?: number;
  animations?: Partial<Record<PetState, HatchPetAnimation>>;
};

export type StyleProfile = {
  id: string;
  label: string;
  description: string;
  assistantName: string;
  mainImage: string;
  hatchPet?: HatchPetConfig;
  mainImageScale: number;
  mainGlossOpacity: number;
  mainGlossBackground: string;
  mainImageFilter: string;
  mainButtonFilter: string;
  mainButtonHoverFilter: string;
  mainIdleAnimation: string;
  mainImageIdleAnimation: string;
  mainGlossAnimation: string;
  thinkingGif: string;
  defaultSystemPrompt: string;
  tokens: StyleTokens;
};

export type StyleProfileOverrides = Omit<
  StyleProfile,
  | "tokens"
  | "mainImageScale"
  | "mainGlossOpacity"
  | "mainGlossBackground"
  | "mainImageFilter"
  | "mainButtonFilter"
  | "mainButtonHoverFilter"
  | "mainIdleAnimation"
  | "mainImageIdleAnimation"
  | "mainGlossAnimation"
> & {
  mainImageScale?: number;
  mainGlossOpacity?: number;
  mainGlossBackground?: string;
  mainImageFilter?: string;
  mainButtonFilter?: string;
  mainButtonHoverFilter?: string;
  mainIdleAnimation?: string;
  mainImageIdleAnimation?: string;
  mainGlossAnimation?: string;
  tokens?: Partial<StyleTokens>;
};

export const blueBaseTokens: StyleTokens = {
  panelBg: "rgba(241, 251, 255, 0.92)",
  panelBorder: "rgba(184, 222, 244, 0.88)",
  titleText: "#2d6388",
  bodyText: "rgba(37, 86, 117, 0.96)",
  mutedText: "rgba(62, 112, 145, 0.9)",
  menuText: "rgba(36, 92, 127, 0.9)",
  menuBorder: "rgba(183, 225, 248, 0.7)",
  menuBg:
    "radial-gradient(circle at 24% 20%, rgba(255, 255, 255, 0.86), rgba(220, 245, 255, 0.82) 46%, rgba(183, 228, 252, 0.72) 100%)",
  toastBg:
    "radial-gradient(circle at 24% 20%, rgba(255, 255, 255, 0.98), rgba(202, 239, 255, 0.9) 48%, rgba(162, 218, 251, 0.82) 100%)",
  toastBorder: "rgba(172, 223, 249, 0.92)",
  toastText: "#22608a",
  footerBg: "rgba(242, 251, 255, 0.92)",
  footerBorder: "rgba(190, 223, 243, 0.82)",
  expTrackBg: "rgba(171, 215, 245, 0.4)",
  expFillFrom: "rgba(126, 203, 255, 0.9)",
  expFillTo: "rgba(77, 171, 236, 0.92)",
  mpTrackBg: "rgba(147, 190, 235, 0.36)",
  mpFillFrom: "rgba(118, 169, 255, 0.9)",
  mpFillTo: "rgba(81, 132, 234, 0.92)",
};

export const createBlueStyleProfile = (overrides: StyleProfileOverrides): StyleProfile => ({
  ...overrides,
  mainImageScale: overrides.mainImageScale ?? 1,
  mainGlossOpacity: overrides.mainGlossOpacity ?? 0.65,
  mainGlossBackground:
    overrides.mainGlossBackground ??
    "radial-gradient(circle at 20% 24%, rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0.16) 52%, rgba(255, 255, 255, 0) 70%)",
  mainImageFilter: overrides.mainImageFilter ?? "contrast(1.05) saturate(1.06) brightness(1.02)",
  mainButtonFilter:
    overrides.mainButtonFilter ??
    "drop-shadow(0 8px 16px rgba(38, 122, 189, 0.144)) drop-shadow(0 0 0.8px rgba(167, 223, 255, 0.495))",
  mainButtonHoverFilter:
    overrides.mainButtonHoverFilter ??
    "drop-shadow(0 13px 26px rgba(37, 127, 197, 0.261)) drop-shadow(0 0 1px rgba(183, 231, 255, 0.558))",
  mainIdleAnimation: overrides.mainIdleAnimation ?? "idle-breathe 1.9s ease-in-out infinite",
  mainImageIdleAnimation: overrides.mainImageIdleAnimation ?? "jelly-gloss 2.4s ease-in-out infinite",
  mainGlossAnimation: overrides.mainGlossAnimation ?? "gloss-drift 2.6s ease-in-out infinite",
  tokens: {
    ...blueBaseTokens,
    ...overrides.tokens,
  },
});
