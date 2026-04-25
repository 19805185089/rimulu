import type { MenuItem, SkillFanItem } from "../types/app";

export const CHECKIN_EXP_GAIN = 10;
export const PROGRESS_STORAGE_KEY = "limulu_progress_v1";
export const MEMO_STORAGE_KEY = "limulu_memos_v1";
export const SETTINGS_STORAGE_KEY = "limulu_settings_v1";
export const SKILL_MP_COST = 20;
export const MP_REGEN_INTERVAL_MS = 30 * 1000;
export const SLIME_CLICK_BOUNCE_MS = 270;
export const MENU_BLUR_AUTO_HIDE_MS = 10 * 1000;

export const MENU_ITEMS: MenuItem[] = [
  { key: "checkin", label: "签到", angle: -154 },
  { key: "skills", label: "技能", angle: -120 },
  { key: "memo", label: "备忘", angle: -86 },
  { key: "chat", label: "聊天", angle: -52 },
  { key: "settings", label: "设置", angle: -18 },
];

export const SLIME_BASE_WIDTH = 366;
export const MENU_BASE_SIZE = 44;
export const SLIME_COMPONENT_GAP_RATIO = 1 / 3;
export const SLIME_SCALE = 0.333333;
export const SLIME_ANCHOR_X_RATIO = 0.32;
export const SLIME_ANCHOR_Y_RATIO = 0.475;
export const MENU_BOOST = 1.1;
export const SLIME_WIDTH = SLIME_BASE_WIDTH * SLIME_SCALE;
export const SLIME_COMPONENT_GAP = SLIME_WIDTH * SLIME_COMPONENT_GAP_RATIO;
export const MENU_ORBIT_RADIUS = SLIME_WIDTH / 2 + (MENU_BASE_SIZE * MENU_BOOST) / 2 + SLIME_COMPONENT_GAP;
export const SKILL_FAN_ITEMS: SkillFanItem[] = [
  { key: "water", label: "水弹" },
  { key: "fire", label: "火焰球" },
];
export const MEMO_BOOST = 1.2;
export const MEMO_BASE_WIDTH = 274;
export const MEMO_GAP = SLIME_COMPONENT_GAP;
export const INTERACTIVE_HIT_PADDING = 6;
export const SWALLOW_HIT_PADDING = 24;
export const SHOW_SWALLOW_DEBUG = false;
