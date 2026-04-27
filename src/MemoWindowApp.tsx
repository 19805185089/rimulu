import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarClock, Pencil, Pin, Plus, Save, Timer, Trash2, X } from "lucide-react";
import { cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";
import { INTERACTIVE_HIT_PADDING, MEMO_BOOST, MEMO_STORAGE_KEY, SETTINGS_STORAGE_KEY } from "./constants/app";
import { getStyleProfile } from "./styles/profiles";
import { applyStyleTokensToRoot } from "./styles/theme";
import { createEmptyMemo, loadMemos, toDatetimeLocalValue } from "./utils/memo";
import { loadAppSettings } from "./utils/settings";
import type { MemoItem } from "./types/app";
import "./App.css";

export default function MemoWindowApp() {
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const panelRef = useRef<HTMLElement | null>(null);
  const windowPosRef = useRef({ x: 0, y: 0 });
  const windowScaleRef = useRef(1);
  const [memos, setMemos] = useState<MemoItem[]>(() => loadMemos());
  const [memoPinned, setMemoPinned] = useState(true);
  const [draggingWindow, setDraggingWindow] = useState(false);
  const [styleId, setStyleId] = useState(() => loadAppSettings().styleId);
  const activeStyle = useMemo(() => getStyleProfile(styleId), [styleId]);
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
    const timer = window.setTimeout(() => {
      try {
        const savedMemos = memos.filter((memo) => memo.saved);
        window.localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(savedMemos));
      } catch {
        // Ignore storage errors to keep the editor interactive.
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [memos]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === MEMO_STORAGE_KEY) {
        setMemos(loadMemos());
      }
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

  useEffect(() => {
    const handleMouseUp = () => setDraggingWindow(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    let disposed = false;
    let movedUnlisten: (() => void) | undefined;
    let scaleUnlisten: (() => void) | undefined;
    let timer: number | undefined;
    let lastIgnoreState: boolean | null = null;

    const syncWindowMetrics = async () => {
      try {
        const [position, scaleFactor] = await Promise.all([appWindow.outerPosition(), appWindow.scaleFactor()]);
        windowPosRef.current = { x: position.x, y: position.y };
        windowScaleRef.current = scaleFactor;
      } catch {
        // Keep previous metrics if API temporarily fails.
      }
    };

    const isCursorInsidePanel = (x: number, y: number) => {
      const panel = panelRef.current;
      if (!panel) return false;
      const rect = panel.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const hitPadding = INTERACTIVE_HIT_PADDING * windowScaleRef.current;
      const left = windowPosRef.current.x + rect.left * windowScaleRef.current - hitPadding;
      const right = windowPosRef.current.x + rect.right * windowScaleRef.current + hitPadding;
      const top = windowPosRef.current.y + rect.top * windowScaleRef.current - hitPadding;
      const bottom = windowPosRef.current.y + rect.bottom * windowScaleRef.current + hitPadding;
      return x >= left && x <= right && y >= top && y <= bottom;
    };

    const loop = async () => {
      if (disposed) return;
      try {
        const cursor = await cursorPosition();
        const shouldCapture = draggingWindow || isCursorInsidePanel(cursor.x, cursor.y);
        const shouldIgnore = !shouldCapture;
        if (lastIgnoreState !== shouldIgnore) {
          await appWindow.setIgnoreCursorEvents(shouldIgnore);
          lastIgnoreState = shouldIgnore;
        }
      } catch {
        // Ignore transient cursor/mutex failures.
      }
      timer = window.setTimeout(() => {
        void loop();
      }, 80);
    };

    const init = async () => {
      await syncWindowMetrics();
      movedUnlisten = await appWindow.onMoved(({ payload }) => {
        windowPosRef.current = { x: payload.x, y: payload.y };
      });
      scaleUnlisten = await appWindow.onScaleChanged(({ payload }) => {
        windowScaleRef.current = payload.scaleFactor;
      });
      void loop();
    };

    void init();
    return () => {
      disposed = true;
      if (typeof timer === "number") {
        window.clearTimeout(timer);
      }
      if (movedUnlisten) movedUnlisten();
      if (scaleUnlisten) scaleUnlisten();
      void appWindow.setIgnoreCursorEvents(false);
    };
  }, [appWindow, draggingWindow]);

  const addMemo = () => {
    setMemos((prev) => [...prev, createEmptyMemo()]);
  };

  const updateMemo = (memoId: string, patch: Partial<MemoItem>) => {
    setMemos((prev) => prev.map((memo) => (memo.id === memoId ? { ...memo, ...patch } : memo)));
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
    setMemos((prev) =>
      prev.map((memo) => {
        if (memo.id !== memoId) return memo;
        const trimmedTitle = memo.title.trim();
        if (!trimmedTitle) return memo;
        return {
          ...memo,
          title: trimmedTitle,
          saved: true,
          editing: false,
        };
      }),
    );
  };

  const removeMemo = (memoId: string) => {
    const target = memos.find((memo) => memo.id === memoId);
    if (!target) return;
    if (!target.saved) {
      setMemos((prev) => prev.filter((memo) => memo.id !== memoId));
      return;
    }
    const label = target.title.trim() || "这条备忘录";
    if (!window.confirm(`确认删除“${label}”吗？`)) return;
    setMemos((prev) => prev.filter((memo) => memo.id !== memoId));
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
        ref={panelRef}
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
            setDraggingWindow(true);
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
