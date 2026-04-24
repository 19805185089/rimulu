import {
  CHECKIN_EXP_GAIN,
  MP_REGEN_INTERVAL_MS,
  PROGRESS_STORAGE_KEY,
} from "../constants/app";
import type { CheckinResult, ProgressState } from "../types/app";

export function getMaxMp(level: number) {
  return 50 + level * 25;
}

export function getStreakBonus(streak: number) {
  if (streak <= 0) return 0;
  const cycleDay = streak % 10 === 0 ? 10 : streak % 10;
  if (cycleDay === 10) return 30;
  if (cycleDay === 5) return 15;
  if (cycleDay === 3) return 8;
  return 0;
}

export function getLocalDayStart(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isSameLocalDay(a: number, b: number) {
  return getLocalDayStart(a) === getLocalDayStart(b);
}

export function getLocalDayDiff(from: number, to: number) {
  const ms = getLocalDayStart(to) - getLocalDayStart(from);
  return Math.floor(ms / 86400000);
}

export function getExpRequired(level: number) {
  return 30 + (level - 1) * 12;
}

export function calculateCheckin(prev: ProgressState, now: number): CheckinResult {
  const lastEffectiveCheckinAt = prev.lastEffectiveCheckinAt;
  let nextStreak = 1;
  if (typeof lastEffectiveCheckinAt === "number" && lastEffectiveCheckinAt > 0) {
    const dayDiff = getLocalDayDiff(lastEffectiveCheckinAt, now);
    if (dayDiff === 1) {
      nextStreak = prev.streak + 1;
    }
  }
  const streakBonus = getStreakBonus(nextStreak);
  const gainedExp = CHECKIN_EXP_GAIN + streakBonus;

  let nextLevel = prev.level;
  let nextExp = prev.exp + gainedExp;
  let nextRequired = getExpRequired(nextLevel);
  let leveledUp = false;

  while (nextExp >= nextRequired) {
    nextExp -= nextRequired;
    nextLevel += 1;
    nextRequired = getExpRequired(nextLevel);
    leveledUp = true;
  }

  return {
    nextProgress: {
      level: nextLevel,
      exp: nextExp,
      checkins: prev.checkins + 1,
      streak: nextStreak,
      mp: prev.mp,
      lastMpRegenAt: prev.lastMpRegenAt,
      lastEffectiveCheckinAt: now,
    },
    gainedExp,
    streakBonus,
    leveledUp,
  };
}

export function applyMpRegen(progress: ProgressState, now: number): ProgressState {
  const maxMp = getMaxMp(progress.level);
  const clampedMp = Math.min(Math.max(0, progress.mp), maxMp);

  if (clampedMp >= maxMp) {
    if (progress.mp === maxMp) {
      return progress;
    }
    return {
      ...progress,
      mp: maxMp,
    };
  }

  const elapsed = Math.max(0, now - progress.lastMpRegenAt);
  const regenTicks = Math.floor(elapsed / MP_REGEN_INTERVAL_MS);
  if (regenTicks <= 0) {
    if (clampedMp === progress.mp) return progress;
    return {
      ...progress,
      mp: clampedMp,
    };
  }

  const nextMp = Math.min(maxMp, clampedMp + regenTicks);
  return {
    ...progress,
    mp: nextMp,
    lastMpRegenAt: progress.lastMpRegenAt + regenTicks * MP_REGEN_INTERVAL_MS,
  };
}

export function loadProgress(): ProgressState {
  const now = Date.now();
  const initial: ProgressState = {
    level: 1,
    exp: 0,
    checkins: 0,
    streak: 0,
    mp: getMaxMp(1),
    lastMpRegenAt: now,
    lastEffectiveCheckinAt: null,
  };

  if (typeof window === "undefined") return initial;

  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    if (
      typeof parsed.level !== "number" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.checkins !== "number" ||
      typeof parsed.streak !== "number"
    ) {
      return initial;
    }

    return applyMpRegen(
      {
        level: Math.max(1, Math.floor(parsed.level)),
        exp: Math.max(0, Math.floor(parsed.exp)),
        checkins: Math.max(0, Math.floor(parsed.checkins)),
        streak: Math.max(0, Math.floor(parsed.streak)),
        mp:
          typeof parsed.mp === "number"
            ? Math.max(0, Math.floor(parsed.mp))
            : getMaxMp(Math.max(1, Math.floor(parsed.level))),
        lastMpRegenAt:
          typeof parsed.lastMpRegenAt === "number" ? Math.max(0, Math.floor(parsed.lastMpRegenAt)) : now,
        lastEffectiveCheckinAt:
          typeof parsed.lastEffectiveCheckinAt === "number" ? Math.max(0, Math.floor(parsed.lastEffectiveCheckinAt)) : null,
      },
      now,
    );
  } catch {
    return initial;
  }
}
