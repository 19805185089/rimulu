import { doraemonBlueStyle } from "./doraemonBlue";
import { miemieNightStyle } from "./miemieNight";
import { patrickPinkStyle } from "./patrickPink";
import { rimuruBlueStyle } from "./rimuruBlue";
import { spongebobYellowStyle } from "./spongebobYellow";
import type { StyleProfile } from "./template";

export type { StyleProfile, StyleTokens } from "./template";

export const DEFAULT_STYLE_ID = "rimuru";

export const STYLE_PROFILES: StyleProfile[] = [
  rimuruBlueStyle,
  doraemonBlueStyle,
  spongebobYellowStyle,
  patrickPinkStyle,
  miemieNightStyle,
];

const STYLE_MAP = new Map(STYLE_PROFILES.map((profile) => [profile.id, profile]));

export const getStyleProfile = (styleId: string | undefined | null): StyleProfile => {
  if (!styleId) return STYLE_MAP.get(DEFAULT_STYLE_ID) ?? STYLE_PROFILES[0];
  return STYLE_MAP.get(styleId) ?? STYLE_MAP.get(DEFAULT_STYLE_ID) ?? STYLE_PROFILES[0];
};

export const normalizeStyleId = (styleId: string | undefined | null): string => {
  if (!styleId) return DEFAULT_STYLE_ID;
  return STYLE_MAP.has(styleId) ? styleId : DEFAULT_STYLE_ID;
};
