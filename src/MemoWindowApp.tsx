import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Bell, CalendarClock, Pencil, Pin, Plus, Save, Timer, Trash2, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MEMO_BOOST, MEMO_STORAGE_KEY, SETTINGS_STORAGE_KEY } from "./constants/app";
import { createHatchPetStyleProfile, getStyleProfile, STYLE_PROFILES } from "./styles/profiles";
import { applyStyleTokensToRoot } from "./styles/theme";
import { HATCH_PETS_STORAGE_KEY, loadInstalledHatchPets } from "./utils/hatchPets";
import { createEmptyMemo, loadMemos, toDatetimeLocalValue } from "./utils/memo";
import { loadAppSettings } from "./utils/settings";
import type { MemoItem } from "./types/app";
import type { StyleProfile } from "./styles/profiles";
import "./App.css";

export default function MemoWindowApp() {
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const [memos, setMemos] = useState<MemoItem[]>(() => loadMemos());
  const [memoPinned, setMemoPinned] = useState(true);
  const [styleId, setStyleId] = useState(() => loadAppSettings().styleId);
  const [hatchPetStyles, setHatchPetStyles] = useState<StyleProfile[]>([]);
  const styleProfiles = useMemo(() => [...STYLE_PROFILES, ...hatchPetStyles], [hatchPetStyles]);
  const activeStyle = useMemo(
    () => styleProfiles.find((styleProfile) => styleProfile.id === styleId) ?? getStyleProfile(styleId),
    [styleId, styleProfiles],
  );
  const panelPosition = useMemo(() => {
    if (typeof window === "undefined") return { x: 170, y: 200 };
    const panelWidth = Math.min(274 * MEMO_BOOST, window.innerWidth - 20);
    const panelHeight = Math.min(320 * MEMO_BOOST, window.innerHeight - 20);
    return {
      x: panelWidth / 2 + 10,
      y: panelHeight / 2 + 10,
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const loadPets = async () => {
      const pets = await loadInstalledHatchPets();
      if (disposed) return;
      setHatchPetStyles(pets.map(createHatchPetStyleProfile));
    };
    void loadPets();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === HATCH_PETS_STORAGE_KEY) {
        void loadPets();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      disposed = true;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === SETTINGS_STORAGE_KEY) {
        setStyleId(loadAppSettings().styleId);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    applyStyleTokensToRoot(activeStyle.tokens);
  }, [activeStyle]);

  const addMemo = () => {
    setMemos((prev) => [...prev, createEmptyMemo()]);
  };

  const updateMemo = (memoId: string, patch: Partial<MemoItem>) => {
    setMemos((prev) => prev.map((memo) => (memo.id === memoId ? { ...memo, ...patch } : memo)));
  };

  const persistSavedMemos = (nextMemos: MemoItem[]) => {
    try {
      const savedMemos = nextMemos.filter((memo) => memo.saved);
      window.localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(savedMemos));
    } catch {
      // Ignore storage errors to keep the editor interactive.
    }
  };

  const toggleMemoCheck = (memoId: string) => {
    setMemos((prev) =>
      prev.map((memo) => {
        if (memo.id !== memoId) return memo;
        const nextChecked = !memo.checked;
        if (!nextChecked) {
          return {
            ...memo,
            checked: false,
            completedAt: "",
            durationMinutes: "",
          };
        }
        const now = Date.now();
        const completedAt = memo.completedAt || toDatetimeLocalValue(now);
        const elapsedMinutes = Math.max(1, Math.round((now - memo.createdAt) / 60000));
        return {
          ...memo,
          checked: true,
          completedAt,
          durationMinutes: memo.durationMinutes || `${elapsedMinutes}`,
        };
      }),
    );
  };

  const saveMemo = (memoId: string) => {
    setMemos((prev) => {
      const nextMemos = prev.map((memo) => {
        if (memo.id !== memoId) return memo;
        const trimmedTitle = memo.title.trim();
        if (!trimmedTitle) return memo;
        return {
          ...memo,
          title: trimmedTitle,
          saved: true,
          editing: false,
        };
      });
      persistSavedMemos(nextMemos);
      return nextMemos;
    });
  };

  const removeMemo = (memoId: string) => {
    const target = memos.find((memo) => memo.id === memoId);
    if (!target) return;
    setMemos((prev) => {
      const nextMemos = prev.filter((memo) => memo.id !== memoId);
      persistSavedMemos(nextMemos);
      return nextMemos;
    });
  };

  const updateMemoReminder = (memoId: string, reminderAt: string) => {
    updateMemo(memoId, {
      reminderAt,
      remindedAt: null,
    });
  };

  const startEditMemo = (memoId: string) => {
    updateMemo(memoId, { editing: true });
  };

  const toggleMemoPinned = () => {
    setMemoPinned((prev) => {
      const next = !prev;
      void appWindow.setAlwaysOnTop(next).catch(() => {
        // Ignore permission/runtime failures and keep current behavior.
      });
      return next;
    });
  };

  return (
    <main className="pet-app">
      <aside
        className="memo-panel open"
        style={
          {
            left: `${panelPosition.x}px`,
            top: `${panelPosition.y}px`,
            "--memo-boost": `${MEMO_BOOST}`,
          } as CSSProperties
        }
      >
        <header
          className="memo-header"
          style={{ cursor: memoPinned ? "default" : "move" }}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            if (memoPinned) return;
            event.preventDefault();
            void appWindow.startDragging();
          }}
        >
          <span className="memo-title">备忘录</span>
          <div
            className="memo-header-actions"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <button type="button" className="memo-top-btn" onClick={addMemo} aria-label="新增备忘录" title="新增备忘录">
              <Plus size={9} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={`memo-top-btn ${memoPinned ? "active" : ""}`}
              onClick={toggleMemoPinned}
              aria-label={memoPinned ? "取消固定窗口" : "固定窗口"}
              title={memoPinned ? "取消固定窗口" : "固定窗口"}
            >
              <Pin size={9} strokeWidth={2.1} />
            </button>
            <button
              type="button"
              className="memo-top-btn"
              onClick={() => {
                void appWindow.hide();
              }}
              aria-label="关闭备忘录"
              title="关闭备忘录"
            >
              <X size={9} strokeWidth={2.2} />
            </button>
          </div>
        </header>
        <div className="memo-list" role="list">
          {memos.length === 0 ? (
            <div className="memo-empty">还没有备忘，点击“新增”开始记录吧。</div>
          ) : (
            memos.map((memo) => (
              <article key={memo.id} className={`memo-row ${memo.checked ? "done" : ""} ${memo.saved ? "saved" : "draft"}`} role="listitem">
                <input
                  type="checkbox"
                  className="memo-check"
                  checked={memo.checked}
                  onChange={() => toggleMemoCheck(memo.id)}
                />
                {memo.editing || !memo.saved ? (
                  <>
                    <textarea
                      className="memo-text"
                      value={memo.title}
                      placeholder="输入备忘内容..."
                      onChange={(event) => updateMemo(memo.id, { title: event.target.value })}
                      rows={2}
                    />
                    <div className="memo-field memo-reminder-field">
                      <Bell className="memo-field-icon" size={9} strokeWidth={2.1} />
                      <input
                        type="datetime-local"
                        className="memo-time"
                        value={memo.reminderAt}
                        aria-label="提醒时间"
                        onChange={(event) => updateMemoReminder(memo.id, event.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="memo-preview" title={memo.title}>
                      {memo.title || "未命名备忘"}
                    </div>
                    {memo.reminderAt && (
                      <div className="memo-meta">
                        <Bell className="memo-field-icon" size={8} strokeWidth={2.1} />
                        <span>{memo.reminderAt.replace("T", " ")}</span>
                      </div>
                    )}
                  </>
                )}
                {memo.saved && (memo.completedAt || memo.durationMinutes) && (
                  <div className="memo-meta">
                    <CalendarClock className="memo-field-icon" size={8} strokeWidth={2.1} />
                    <span>{memo.completedAt ? memo.completedAt.replace("T", " ") : "未完成"}</span>
                    <Timer className="memo-field-icon" size={8} strokeWidth={2.1} />
                    <span>{memo.durationMinutes ? `${memo.durationMinutes} 分` : "--"}</span>
                  </div>
                )}
                <div className="memo-actions">
                  {memo.editing || !memo.saved ? (
                    <button
                      type="button"
                      className={`memo-save ${memo.saved ? "saved" : ""}`}
                      onClick={() => saveMemo(memo.id)}
                      aria-label={memo.saved ? "更新备忘录" : "保存备忘录"}
                      title={memo.saved ? "更新备忘录" : "保存备忘录"}
                    >
                      <Save size={9} strokeWidth={2.1} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="memo-edit"
                      onClick={() => startEditMemo(memo.id)}
                      aria-label="编辑备忘录"
                      title="编辑备忘录"
                    >
                      <Pencil size={9} strokeWidth={2.15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="memo-delete"
                    onClick={() => removeMemo(memo.id)}
                    aria-label="删除备忘录"
                    title="删除备忘录"
                  >
                    <Trash2 size={9} strokeWidth={2.15} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </aside>
    </main>
  );
}
