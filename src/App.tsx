import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CalendarClock, Pencil, Pin, Plus, Save, Timer, Trash2, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize, cursorPosition, currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import MenuRing from "./components/MenuRing";
import SkillFan from "./components/SkillFan";
import {
  INTERACTIVE_HIT_PADDING,
  MEMO_STORAGE_KEY,
  MEMO_BASE_WIDTH,
  MEMO_BOOST,
  MEMO_GAP,
  MENU_BLUR_AUTO_HIDE_MS,
  PROGRESS_STORAGE_KEY,
  SHOW_SWALLOW_DEBUG,
  SKILL_MP_COST,
  SLIME_ANCHOR_X_RATIO,
  SLIME_ANCHOR_Y_RATIO,
  SLIME_CLICK_BOUNCE_MS,
  SLIME_WIDTH,
  SWALLOW_HIT_PADDING,
} from "./constants/app";
import { createEmptyMemo, loadMemos, toDatetimeLocalValue } from "./utils/memo";
import {
  applyMpRegen,
  calculateCheckin,
  getExpRequired,
  getMaxMp,
  isSameLocalDay,
  loadProgress,
} from "./utils/progress";
import { playSlimeClickSound } from "./utils/sound";
import type { MemoItem, PetState, ProgressState, SkillEffectType } from "./types/app";
import "./App.css";

function App() {
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const stageRef = useRef<HTMLElement | null>(null);
  const swallowZoneRef = useRef<HTMLDivElement | null>(null);
  const slimeRef = useRef<HTMLButtonElement | null>(null);
  const menuRingRef = useRef<HTMLDivElement | null>(null);
  const skillFanRef = useRef<HTMLDivElement | null>(null);
  const memoPanelRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const swallowConfirmDialogRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const memoDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const slimePointerRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const swallowHotRef = useRef(false);
  const swallowConfirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const windowPosRef = useRef({ x: 0, y: 0 });
  const windowScaleRef = useRef(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [memoPanelOpen, setMemoPanelOpen] = useState(false);
  const [memoPinned, setMemoPinned] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const [pressedMenuKey, setPressedMenuKey] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState("等待交互");
  const [toastText, setToastText] = useState<string | null>(null);
  const [activeSkillEffect, setActiveSkillEffect] = useState<SkillEffectType | null>(null);
  const [skillEffectSeed, setSkillEffectSeed] = useState(0);
  const [memoPosition, setMemoPosition] = useState(() => {
    if (typeof window === "undefined") return { x: 660, y: 450 };
    const memoWidth = MEMO_BASE_WIDTH * MEMO_BOOST;
    return {
      x: window.innerWidth * SLIME_ANCHOR_X_RATIO + SLIME_WIDTH / 2 + memoWidth / 2 + MEMO_GAP,
      y: window.innerHeight * SLIME_ANCHOR_Y_RATIO,
    };
  });
  const [draggedPaths, setDraggedPaths] = useState<string[]>([]);
  const [isSwallowHot, setIsSwallowHot] = useState(false);
  const [isSwallowing, setIsSwallowing] = useState(false);
  const [swallowConfirmCount, setSwallowConfirmCount] = useState<number | null>(null);
  const [systemNotifyGranted, setSystemNotifyGranted] = useState(false);
  const [windowFocused, setWindowFocused] = useState(true);
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const [memos, setMemos] = useState<MemoItem[]>(() => loadMemos());

  const petState: PetState = useMemo(() => {
    if (menuOpen || skillMenuOpen || memoPanelOpen) return "active";
    return "idle";
  }, [menuOpen, skillMenuOpen, memoPanelOpen]);

  const expRequired = useMemo(() => getExpRequired(progress.level), [progress.level]);
  const expPercent = Math.min((progress.exp / expRequired) * 100, 100);
  const maxMp = useMemo(() => getMaxMp(progress.level), [progress.level]);
  const mpPercent = Math.min((progress.mp / maxMp) * 100, 100);
  const isFileDragging = draggedPaths.length > 0;

  const isPositionInsideSwallowZone = (position: { x: number; y: number }) => {
    const zone = swallowZoneRef.current;
    if (!zone) return false;
    const zoneRect = zone.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const candidates = [
      { x: position.x, y: position.y },
      { x: position.x / dpr, y: position.y / dpr },
    ];

    return candidates.some(
      (candidate) =>
        candidate.x >= zoneRect.left - SWALLOW_HIT_PADDING &&
        candidate.x <= zoneRect.right + SWALLOW_HIT_PADDING &&
        candidate.y >= zoneRect.top - SWALLOW_HIT_PADDING &&
        candidate.y <= zoneRect.bottom + SWALLOW_HIT_PADDING,
    );
  };

  const updateSwallowHot = (nextHot: boolean) => {
    swallowHotRef.current = nextHot;
    setIsSwallowHot(nextHot);
  };

  const closeSwallowConfirm = (confirmed: boolean) => {
    const resolver = swallowConfirmResolverRef.current;
    swallowConfirmResolverRef.current = null;
    setSwallowConfirmCount(null);
    if (resolver) resolver(confirmed);
  };

  const requestSwallowConfirm = (count: number) => {
    setSwallowConfirmCount(count);
    return new Promise<boolean>((resolve) => {
      swallowConfirmResolverRef.current = resolve;
    });
  };

  const getDefaultMemoPosition = () => {
    const memoWidth = MEMO_BASE_WIDTH * MEMO_BOOST;
    if (typeof window === "undefined") return { x: 660, y: 450 };
    return {
      x: window.innerWidth * SLIME_ANCHOR_X_RATIO + SLIME_WIDTH / 2 + memoWidth / 2 + MEMO_GAP,
      y: window.innerHeight * SLIME_ANCHOR_Y_RATIO,
    };
  };

  useEffect(() => {
    const handleBlur = () => setWindowFocused(false);
    const handleFocus = () => setWindowFocused(true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (windowFocused) return;
    if (!menuOpen && !skillMenuOpen) return;
    const timer = window.setTimeout(() => {
      setMenuOpen(false);
      setSkillMenuOpen(false);
      setLastAction("失焦后自动收起菜单");
    }, MENU_BLUR_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [windowFocused, menuOpen, skillMenuOpen]);

  useEffect(() => {
    return () => {
      const context = audioContextRef.current;
      if (context && context.state !== "closed") {
        void context.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const timer = window.setTimeout(() => setToastText(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toastText]);

  useEffect(() => {
    if (!activeSkillEffect) return;
    const timer = window.setTimeout(() => setActiveSkillEffect(null), 820);
    return () => window.clearTimeout(timer);
  }, [activeSkillEffect, skillEffectSeed]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
      } catch {
        // Ignore storage failures and keep runtime behavior stable.
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [progress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedMemos = memos.filter((memo) => memo.saved);
        window.localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(savedMemos));
      } catch {
        // Ignore storage failures and keep runtime behavior stable.
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [memos]);

  useEffect(() => {
    let cancelled = false;
    const initNotificationPermission = async () => {
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === "granted";
        }
        if (!cancelled) {
          setSystemNotifyGranted(granted);
        }
      } catch {
        if (!cancelled) {
          setSystemNotifyGranted(false);
        }
      }
    };
    void initNotificationPermission();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const nowMinute = toDatetimeLocalValue(now);
      let remindMemoTitle: string | null = null;

      setMemos((prev) =>
        prev.map((memo) => {
          if (!memo.saved || !memo.reminderAt) return memo;
          if (memo.remindedAt && memo.remindedAt > 0) return memo;
          if (memo.reminderAt > nowMinute) return memo;
          if (!remindMemoTitle) remindMemoTitle = memo.title || "未命名备忘";
          return {
            ...memo,
            remindedAt: now,
          };
        }),
      );

      if (remindMemoTitle) {
        const reminderMessage = `备忘提醒：${remindMemoTitle}`;
        setToastText(reminderMessage);
        setLastAction("触发备忘提醒");
        if (systemNotifyGranted) {
          try {
            sendNotification({
              title: "利姆露备忘提醒",
              body: remindMemoTitle,
            });
          } catch {
            // Keep in-app reminder as fallback.
          }
        }
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [systemNotifyGranted]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const bindDragDropListener = async () => {
      try {
        unlisten = await appWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === "enter") {
            setDraggedPaths(event.payload.paths);
            updateSwallowHot(isPositionInsideSwallowZone(event.payload.position));
            return;
          }
          if (event.payload.type === "over") {
            updateSwallowHot(isPositionInsideSwallowZone(event.payload.position));
            return;
          }
          if (event.payload.type === "leave") {
            setDraggedPaths([]);
            updateSwallowHot(false);
            return;
          }
          if (event.payload.type === "drop") {
            const dropped = event.payload.paths;
            const hitSwallowZone = swallowHotRef.current || isPositionInsideSwallowZone(event.payload.position);
            setDraggedPaths([]);
            updateSwallowHot(false);
            if (!dropped.length) return;
            if (!hitSwallowZone) {
              setToastText("未命中吞噬区，文件未处理");
              setLastAction("吞噬命中失败");
              return;
            }

            const confirmed = await requestSwallowConfirm(dropped.length);
            if (!confirmed) {
              setToastText("已取消吞噬");
              setLastAction("取消吞噬删除");
              return;
            }

            setIsSwallowing(true);
            try {
              const deletedCount = await invoke<number>("swallow_delete_to_trash", { paths: dropped });
              setToastText(`吞噬成功，已移入回收站 ${deletedCount} 项`);
              setLastAction(`吞噬删除成功 ${deletedCount} 项`);
            } catch {
              setToastText("吞噬失败，请检查文件权限");
              setLastAction("吞噬删除失败");
            } finally {
              window.setTimeout(() => setIsSwallowing(false), 680);
            }
          }
        });
      } catch {
        setLastAction("吞噬功能初始化失败");
      }
    };

    void bindDragDropListener();
    return () => {
      if (swallowConfirmResolverRef.current) {
        swallowConfirmResolverRef.current(false);
        swallowConfirmResolverRef.current = null;
      }
      if (unlisten) unlisten();
    };
  }, [appWindow]);

  useEffect(() => {
    let disposed = false;
    const syncWindowToWorkArea = async () => {
      try {
        const monitor = await currentMonitor();
        if (!monitor || disposed) return;
        const area = monitor.workArea;
        await appWindow.setPosition(new PhysicalPosition(area.position.x, area.position.y));
        await appWindow.setSize(new PhysicalSize(area.size.width, area.size.height));
      } catch {
        // Keep current size if API is unavailable.
      }
    };
    void syncWindowToWorkArea();
    return () => {
      disposed = true;
    };
  }, [appWindow]);

  useEffect(() => {
    let disposed = false;
    let movedUnlisten: (() => void) | undefined;
    let scaleUnlisten: (() => void) | undefined;
    let timer: number | undefined;
    let lastIgnoreState: boolean | null = null;
    let ignoreErrorLogged = false;
    const isPointInsideInteractiveElements = (x: number, y: number) => {
      if (memoDragRef.current) {
        return true;
      }
      const targets: HTMLElement[] = [];
      const appendTarget = (element: HTMLElement | null) => {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const style = window.getComputedStyle(element);
        if (style.pointerEvents === "none" || style.visibility === "hidden") return;
        if (Number.parseFloat(style.opacity || "1") <= 0) return;
        targets.push(element);
      };

      appendTarget(slimeRef.current);
      if (menuOpen) {
        appendTarget(footerRef.current);
        if (menuRingRef.current) {
          const menuButtons = menuRingRef.current.querySelectorAll<HTMLElement>(".menu-item");
          menuButtons.forEach((button) => appendTarget(button));
        }
      }
      if (skillMenuOpen) {
        if (skillFanRef.current) {
          const skillButtons = skillFanRef.current.querySelectorAll<HTMLElement>(".skill-fan-item");
          skillButtons.forEach((button) => appendTarget(button));
        }
      }
      if (memoPanelOpen) {
        appendTarget(memoPanelRef.current);
      }
      if (swallowConfirmCount !== null) {
        appendTarget(swallowConfirmDialogRef.current);
      }

      for (const target of targets) {
        const rect = target.getBoundingClientRect();
        const hitPadding = INTERACTIVE_HIT_PADDING * windowScaleRef.current;
        const left = windowPosRef.current.x + rect.left * windowScaleRef.current - hitPadding;
        const right = windowPosRef.current.x + rect.right * windowScaleRef.current + hitPadding;
        const top = windowPosRef.current.y + rect.top * windowScaleRef.current - hitPadding;
        const bottom = windowPosRef.current.y + rect.bottom * windowScaleRef.current + hitPadding;
        if (x >= left && x <= right && y >= top && y <= bottom) {
          return true;
        }
      }
      return false;
    };

    const syncWindowMetrics = async () => {
      try {
        const [position, scaleFactor] = await Promise.all([appWindow.outerPosition(), appWindow.scaleFactor()]);
        windowPosRef.current = { x: position.x, y: position.y };
        windowScaleRef.current = scaleFactor;
      } catch {
        // Keep last metrics and continue.
      }
    };

    const loop = async () => {
      if (disposed) return;
      try {
        const cursor = await cursorPosition();
        const shouldCapture = isPointInsideInteractiveElements(cursor.x, cursor.y);
        const shouldIgnore = !shouldCapture;
        if (lastIgnoreState !== shouldIgnore) {
          try {
            await appWindow.setIgnoreCursorEvents(shouldIgnore);
            lastIgnoreState = shouldIgnore;
            ignoreErrorLogged = false;
          } catch {
            if (!ignoreErrorLogged) {
              ignoreErrorLogged = true;
              console.warn("setIgnoreCursorEvents 调用失败，请检查 capability 权限与平台支持。");
            }
          }
        }
      } catch {
        // Ignore transient failures from OS cursor API.
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
  }, [appWindow, menuOpen, skillMenuOpen, memoPanelOpen, swallowConfirmCount]);

  const toggleMenu = () => {
    setMenuOpen((prev) => {
      if (prev) {
        setSkillMenuOpen(false);
        if (!memoPinned) setMemoPanelOpen(false);
      }
      return !prev;
    });
    setLastAction((prev) => (prev === "展开菜单" ? "收起菜单" : "展开菜单"));
  };

  const triggerSlimeClickAction = () => {
    playSlimeClickSound(audioContextRef);
    setIsBouncing(true);
    window.setTimeout(() => setIsBouncing(false), SLIME_CLICK_BOUNCE_MS);
    toggleMenu();
  };

  const handleSlimeMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    slimePointerRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handleSlimeMouseMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const pointer = slimePointerRef.current;
    if (!pointer || pointer.moved) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 4) return;
    pointer.moved = true;
    void appWindow.startDragging().catch(() => {
      // Keep click path available when drag cannot start.
    });
  };

  const handleSlimeMouseUp = () => {
    const pointer = slimePointerRef.current;
    if (!pointer) return;
    slimePointerRef.current = null;
    if (!pointer.moved) {
      triggerSlimeClickAction();
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setProgress((prev) => applyMpRegen(prev, now));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleCheckin = () => {
    const now = Date.now();
    const base = applyMpRegen(progress, now);
    if (
      typeof base.lastEffectiveCheckinAt === "number" &&
      base.lastEffectiveCheckinAt > 0 &&
      isSameLocalDay(base.lastEffectiveCheckinAt, now)
    ) {
      setProgress(base);
      setMenuOpen(false);
      setLastAction("今日已签到");
      setToastText("今日已完成签到，明天 00:00 后可再次签到");
      return;
    }

    const result = calculateCheckin(base, now);
    const streakText = result.streakBonus > 0 ? `（连签奖励 +${result.streakBonus}）` : "";
    setProgress(result.nextProgress);

    setIsBouncing(true);
    window.setTimeout(() => setIsBouncing(false), SLIME_CLICK_BOUNCE_MS);
    setMenuOpen(false);
    setLastAction(`签到成功 +${result.gainedExp} EXP${streakText}`);
    if (result.leveledUp) {
      setToastText(`签到成功！Lv.UP +${result.gainedExp} EXP`);
      return;
    }
    setToastText(`签到成功 +${result.gainedExp} EXP${result.streakBonus > 0 ? " 连签奖励" : ""}`);
  };

  const castSkill = (skillLabel: string) => {
    const now = Date.now();
    const base = applyMpRegen(progress, now);
    if (base.mp < SKILL_MP_COST) {
      setProgress(base);
      setLastAction(`${skillLabel}释放失败，MP不足`);
      setToastText(`MP不足，${skillLabel}需要 ${SKILL_MP_COST} MP`);
      setSkillMenuOpen(false);
      return;
    }

    const gainedExp = Math.floor(Math.random() * 16) + 5;
    let nextLevel = base.level;
    let nextExp = base.exp + gainedExp;
    let nextRequired = getExpRequired(nextLevel);
    let leveledUp = false;
    while (nextExp >= nextRequired) {
      nextExp -= nextRequired;
      nextLevel += 1;
      nextRequired = getExpRequired(nextLevel);
      leveledUp = true;
    }

    setProgress({
      ...base,
      level: nextLevel,
      exp: nextExp,
      mp: base.mp - SKILL_MP_COST,
      lastMpRegenAt: now,
    });
    setLastAction(`释放${skillLabel} -${SKILL_MP_COST} MP +${gainedExp} EXP`);
    if (leveledUp) {
      setToastText(`${skillLabel}发动成功 +${gainedExp} EXP（Lv.UP）`);
    } else {
      setToastText(`${skillLabel}发动成功 -${SKILL_MP_COST} MP +${gainedExp} EXP`);
    }
    setActiveSkillEffect(skillLabel === "水弹" ? "water" : "fire");
    setSkillEffectSeed((prev) => prev + 1);
    setSkillMenuOpen(false);
    setMenuOpen(false);
  };

  const openMemoPanel = () => {
    setMemoPosition(getDefaultMemoPosition());
    setMemoPanelOpen(true);
    setSkillMenuOpen(false);
    setMenuOpen(false);
    setLastAction("打开备忘录");
  };

  const closeMemoPanel = () => {
    setMemoPanelOpen(false);
    setLastAction("关闭备忘录");
  };

  const addMemo = () => {
    setMemos((prev) => [...prev, createEmptyMemo()]);
    setLastAction("新增备忘录");
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
    let saved = false;
    setMemos((prev) =>
      prev.map((memo) => {
        if (memo.id !== memoId) return memo;
        const trimmedTitle = memo.title.trim();
        if (!trimmedTitle) return memo;
        saved = true;
        return {
          ...memo,
          title: trimmedTitle,
          saved: true,
          editing: false,
        };
      }),
    );
    if (saved) {
      setToastText("备忘录已保存");
      setLastAction("保存备忘录");
      return;
    }
    setToastText("请先填写备忘内容再保存");
  };

  const removeMemo = (memoId: string) => {
    const target = memos.find((memo) => memo.id === memoId);
    if (!target) return;
    if (!target.saved) {
      setMemos((prev) => prev.filter((memo) => memo.id !== memoId));
      setLastAction("删除草稿备忘录");
      return;
    }
    const label = target.title.trim() || "这条备忘录";
    const confirmed = window.confirm(`确认删除“${label}”吗？`);
    if (!confirmed) return;
    setMemos((prev) => prev.filter((memo) => memo.id !== memoId));
    setLastAction("删除备忘录");
  };

  const toggleMemoPinned = () => {
    setMemoPinned((prev) => !prev);
    setLastAction((prev) => (prev === "固定备忘录" ? "取消固定备忘录" : "固定备忘录"));
  };

  const updateMemoReminder = (memoId: string, reminderAt: string) => {
    updateMemo(memoId, {
      reminderAt,
      remindedAt: null,
    });
  };

  const startEditMemo = (memoId: string) => {
    updateMemo(memoId, { editing: true });
    setLastAction("编辑备忘录");
  };

  const handleMemoHeaderMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    memoDragRef.current = {
      offsetX: event.clientX - memoPosition.x,
      offsetY: event.clientY - memoPosition.y,
    };

    const handleMove = (moveEvent: MouseEvent) => {
      if (!memoDragRef.current) return;
      setMemoPosition({
        x: moveEvent.clientX - memoDragRef.current.offsetX,
        y: moveEvent.clientY - memoDragRef.current.offsetY,
      });
    };
    const handleUp = () => {
      memoDragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleToggleSkills = () => {
    setSkillMenuOpen((prev) => !prev);
    setLastAction((prev) => (prev.includes("技能") ? "收起技能菜单" : "展开技能菜单"));
  };

  const handleShowSwallowGuide = () => {
    setMenuOpen(false);
    setSkillMenuOpen(false);
    setLastAction("查看吞噬功能说明");
    setToastText("吞噬：将文件拖拽到史莱姆嘴部热区，确认后移入回收站");
  };

  const handlePendingFeature = () => {
    setMenuOpen(false);
    setSkillMenuOpen(false);
    setLastAction("点击待定功能");
    setToastText("待定功能：功能规划中，敬请期待");
  };

  const memoPanelNode = (
    <aside
      className={`memo-panel ${memoPanelOpen ? "open" : "closed"} ${memoPinned ? "pinned" : ""}`}
      style={
        {
          left: `${memoPosition.x}px`,
          top: `${memoPosition.y}px`,
          "--memo-boost": `${MEMO_BOOST}`,
        } as CSSProperties
      }
      onClick={(event) => event.stopPropagation()}
      ref={memoPanelRef}
    >
      <header className="memo-header" onMouseDown={handleMemoHeaderMouseDown}>
        <span className="memo-title">备忘录</span>
        <div className="memo-header-actions">
          <button type="button" className="memo-top-btn" onClick={addMemo} aria-label="新增备忘录" title="新增备忘录">
            <Plus size={9} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className={`memo-top-btn ${memoPinned ? "active" : ""}`}
            onClick={toggleMemoPinned}
            aria-label={memoPinned ? "取消固定备忘录" : "固定备忘录"}
            title={memoPinned ? "取消固定备忘录" : "固定备忘录"}
          >
            <Pin size={9} strokeWidth={2.1} />
          </button>
          <button type="button" className="memo-top-btn" onClick={closeMemoPanel} aria-label="关闭备忘录" title="关闭备忘录">
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
                  <input
                    type="text"
                    className="memo-text"
                    value={memo.title}
                    placeholder="输入备忘内容..."
                    onChange={(event) => updateMemo(memo.id, { title: event.target.value })}
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
  );
  const memoPanelLayer = typeof document === "undefined" ? memoPanelNode : createPortal(memoPanelNode, document.body);
  const swallowConfirmDialogStyle: CSSProperties = {
    left: `${SLIME_ANCHOR_X_RATIO * 100}%`,
    top: `calc(${SLIME_ANCHOR_Y_RATIO * 100}% - ${SLIME_WIDTH * 2}px)`,
  };

  return (
    <main className="pet-app">
      <section className="pet-stage" ref={stageRef}>
        <div className="pet-stage-inner">
          {toastText && <div className="checkin-toast">{toastText}</div>}

          <MenuRing
            menuOpen={menuOpen}
            pressedMenuKey={pressedMenuKey}
            setPressedMenuKey={setPressedMenuKey}
            menuRingRef={menuRingRef}
            onCheckin={handleCheckin}
            onToggleSkills={handleToggleSkills}
            onOpenMemo={openMemoPanel}
            onShowSwallowGuide={handleShowSwallowGuide}
            onClickPending={handlePendingFeature}
            onFallbackClick={(label) => setLastAction(`点击${label}`)}
          />
          <SkillFan open={skillMenuOpen} skillFanRef={skillFanRef} onCastSkill={castSkill} />
          <div
            className={`swallow-zone ${isFileDragging || SHOW_SWALLOW_DEBUG ? "visible" : ""} ${isSwallowHot ? "hot" : ""} ${isSwallowing ? "swallowing" : ""}`}
            ref={swallowZoneRef}
            aria-hidden="true"
          />

          <button
            className={`slime-btn state-${petState} ${isBouncing ? "is-bouncing" : ""}`}
            onMouseDown={handleSlimeMouseDown}
            onMouseMove={handleSlimeMouseMove}
            onMouseUp={handleSlimeMouseUp}
            onMouseLeave={handleSlimeMouseUp}
            onClick={(event) => event.preventDefault()}
            aria-label="史莱姆主按钮"
            ref={slimeRef}
          >
            <img src="/rimuru-slime.png" className="slime-image" alt="利姆露史莱姆形态" />
          </button>
          {activeSkillEffect && (
            <div
              key={`${activeSkillEffect}-${skillEffectSeed}`}
              className={`skill-cast skill-${activeSkillEffect}`}
              aria-hidden="true"
            >
              <span className="skill-core" />
              <span className="skill-trail" />
              <span className="skill-spark skill-spark-a" />
              <span className="skill-spark skill-spark-b" />
              <span className="skill-spark skill-spark-c" />
              <span className="skill-impact skill-impact-ring" />
              <span className="skill-impact skill-impact-core" />
              <span className="skill-impact-spark skill-impact-spark-a" />
              <span className="skill-impact-spark skill-impact-spark-b" />
              <span className="skill-impact-spark skill-impact-spark-c" />
            </div>
          )}

          <footer
            className={`pet-footer level-panel ${menuOpen ? "open" : "closed"}`}
            onClick={(event) => event.stopPropagation()}
            title={lastAction}
            ref={footerRef}
          >
            <div className="level-topline">
              <span>Lv.{progress.level}</span>
              <span>
                EXP {progress.exp}/{expRequired}
              </span>
              <span>
                MP {progress.mp}/{maxMp}
              </span>
            </div>
            <div className="exp-track">
              <div className="exp-fill" style={{ width: `${expPercent}%` }} />
            </div>
            <div className="mp-track">
              <div className="mp-fill" style={{ width: `${mpPercent}%` }} />
            </div>
            <div className="level-hint">签到 {progress.checkins} · 连签 {progress.streak}</div>
          </footer>
        </div>
      </section>
      {memoPanelLayer}
      {swallowConfirmCount !== null && (
        <div className="swallow-confirm-overlay">
          <div
            className="swallow-confirm-dialog"
            ref={swallowConfirmDialogRef}
            style={swallowConfirmDialogStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="swallow-confirm-title">确认吞噬</div>
            <div className="swallow-confirm-text">确认将 {swallowConfirmCount} 项移入回收站吗？</div>
            <div className="swallow-confirm-actions">
              <button type="button" className="swallow-confirm-btn cancel" onClick={() => closeSwallowConfirm(false)}>
                取消
              </button>
              <button type="button" className="swallow-confirm-btn confirm" onClick={() => closeSwallowConfirm(true)}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
