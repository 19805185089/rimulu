import { MEMO_STORAGE_KEY } from "../constants/app";
import type { MemoItem } from "../types/app";

function createMemoId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `memo-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function toDatetimeLocalValue(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function createEmptyMemo(): MemoItem {
  return {
    id: createMemoId(),
    title: "",
    saved: false,
    editing: true,
    checked: false,
    completedAt: "",
    durationMinutes: "",
    reminderAt: "",
    remindedAt: null,
    createdAt: Date.now(),
  };
}

export function loadMemos(): MemoItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MEMO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const candidate = item as Partial<MemoItem>;
        if (typeof candidate.id !== "string") return null;
        return {
          id: candidate.id,
          title: typeof candidate.title === "string" ? candidate.title : "",
          saved: typeof candidate.saved === "boolean" ? candidate.saved : true,
          editing: false,
          checked: Boolean(candidate.checked),
          completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : "",
          durationMinutes: typeof candidate.durationMinutes === "string" ? candidate.durationMinutes : "",
          reminderAt: typeof candidate.reminderAt === "string" ? candidate.reminderAt : "",
          remindedAt: typeof candidate.remindedAt === "number" ? candidate.remindedAt : null,
          createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now(),
        };
      })
      .filter((item): item is MemoItem => item !== null && item.saved);
  } catch {
    return [];
  }
}
