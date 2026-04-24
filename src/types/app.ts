export type PetState = "idle" | "hover" | "active";

export type ProgressState = {
  level: number;
  exp: number;
  checkins: number;
  streak: number;
  mp: number;
  lastMpRegenAt: number;
  lastEffectiveCheckinAt: number | null;
};

export type CheckinResult = {
  nextProgress: ProgressState;
  gainedExp: number;
  streakBonus: number;
  leveledUp: boolean;
};

export type SkillEffectType = "water" | "fire";

export type MemoItem = {
  id: string;
  title: string;
  saved: boolean;
  editing: boolean;
  checked: boolean;
  completedAt: string;
  durationMinutes: string;
  reminderAt: string;
  remindedAt: number | null;
  createdAt: number;
};

export type MenuItem = {
  key: string;
  label: string;
  angle: number;
};

export type SkillFanItem = {
  key: string;
  label: string;
  offsetX: number;
  offsetY: number;
  delay: number;
};
