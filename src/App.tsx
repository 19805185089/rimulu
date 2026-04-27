import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CalendarClock, Pencil, Pin, Plus, Save, Timer, Trash2, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize, cursorPosition, currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import ChatPanel from "./components/ChatPanel";
import MenuRing from "./components/MenuRing";
import SettingsPanel from "./components/SettingsPanel";
import SkillFan from "./components/SkillFan";
import {
  INTERACTIVE_HIT_PADDING,
  MEMO_STORAGE_KEY,
  MEMO_BOOST,
  MENU_BASE_SIZE,
  MENU_BOOST,
  MENU_BLUR_AUTO_HIDE_MS,
  PROGRESS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
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
import { requestLlmReply } from "./utils/llm";
import { loadAppSettings, normalizeLlmConfig } from "./utils/settings";
import { getStyleProfile, STYLE_PROFILES } from "./styles/profiles";
import { applyStyleTokensToRoot } from "./styles/theme";
import { playSlimeClickSound } from "./utils/sound";
import type { ChatMessage, LlmConfig, MemoItem, PetState, ProgressState, SkillEffectType } from "./types/app";
import "./App.css";

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

function App() {
  const PANEL_BASE_WIDTH = 274 * MEMO_BOOST;
  const PANEL_BASE_HEIGHT = 320 * MEMO_BOOST;
  const CHAT_PANEL_BASE_HEIGHT = 840 * MEMO_BOOST;
  const CHAT_CHILD_WINDOW_WIDTH = 720;
  const CHAT_CHILD_WINDOW_HEIGHT = 940;
  const CHAT_CHILD_WINDOW_LABEL = "chat-window";
  const MEMO_CHILD_WINDOW_WIDTH = 380;
  const MEMO_CHILD_WINDOW_HEIGHT = 560;
  const MEMO_CHILD_WINDOW_LABEL = "memo-window";
  const SETTINGS_PANEL_BASE_WIDTH = PANEL_BASE_WIDTH * 1.25;
  const SETTINGS_PANEL_BASE_HEIGHT = 430 * MEMO_BOOST;
  const PANEL_EDGE_PADDING = 10;
  const clamp = (value: number, min: number, max: number) => {
    if (max < min) return (min + max) / 2;
    return Math.min(Math.max(value, min), max);
  };
  const clampPanelPosition = (
    position: { x: number; y: number },
    options?: {
      panelWidth?: number;
      panelHeight?: number;
    },
  ) => {
    if (typeof window === "undefined") return position;
    const panelWidth = options?.panelWidth ?? PANEL_BASE_WIDTH;
    const panelHeight = options?.panelHeight ?? PANEL_BASE_HEIGHT;
    const minX = PANEL_EDGE_PADDING + panelWidth / 2;
    const maxX = window.innerWidth - PANEL_EDGE_PADDING - panelWidth / 2;
    const minY = PANEL_EDGE_PADDING + panelHeight / 2;
    const maxY = window.innerHeight - PANEL_EDGE_PADDING - panelHeight / 2;
    return {
      x: clamp(position.x, minX, maxX),
      y: clamp(position.y, minY, maxY),
    };
  };
  const getDefaultFloatingPanelPosition = (panelHeight = PANEL_BASE_HEIGHT) => {
    if (typeof window === "undefined") return { x: 660, y: 450 };
    const slimeHeight = (SLIME_WIDTH * 254) / 366;
    const menuDiameter = MENU_BASE_SIZE * MENU_BOOST;
    const gap = menuDiameter * 0.75;
    return clampPanelPosition({
      x: window.innerWidth * SLIME_ANCHOR_X_RATIO,
      y: window.innerHeight * SLIME_ANCHOR_Y_RATIO - slimeHeight / 2 - gap - panelHeight / 2,
    }, { panelHeight });
  };
  const createChatMessage = (role: "user" | "assistant", content: string): ChatMessage => ({
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `chat-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    role,
    content,
    createdAt: Date.now(),
  });

  const appWindow = useMemo(() => getCurrentWindow(), []);
  const stageRef = useRef<HTMLElement | null>(null);
  const swallowZoneRef = useRef<HTMLDivElement | null>(null);
  const slimeRef = useRef<HTMLButtonElement | null>(null);
  const menuRingRef = useRef<HTMLDivElement | null>(null);
  const skillFanRef = useRef<HTMLDivElement | null>(null);
  const memoPanelRef = useRef<HTMLElement | null>(null);
  const chatPanelRef = useRef<HTMLElement | null>(null);
  const settingsPanelRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const swallowConfirmDialogRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const memoDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const skillPanelDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const chatPanelDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const settingsPanelDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const slimePointerRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const slimeMoveListenerRef = useRef<((event: MouseEvent) => void) | null>(null);
  const slimeUpListenerRef = useRef<((event: MouseEvent) => void) | null>(null);
  const windowPosRef = useRef({ x: 0, y: 0 });
  const windowScaleRef = useRef(1);
  const swallowHotRef = useRef(false);
  const confirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const initialSettingsRef = useRef(loadAppSettings());
  const swallowEnabledRef = useRef(initialSettingsRef.current.swallowEnabled);
  const [menuOpen, setMenuOpen] = useState(false);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [memoPanelOpen, setMemoPanelOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [memoPinned, setMemoPinned] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const [pressedMenuKey, setPressedMenuKey] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState("等待交互");
  const [toastText, setToastText] = useState<string | null>(null);
  const [activeSkillEffect, setActiveSkillEffect] = useState<SkillEffectType | null>(null);
  const [skillEffectSeed, setSkillEffectSeed] = useState(0);
  const [memoPosition, setMemoPosition] = useState(() => getDefaultFloatingPanelPosition());
  const [skillPanelPosition, setSkillPanelPosition] = useState(() => getDefaultFloatingPanelPosition());
  const [chatPanelPosition, setChatPanelPosition] = useState(() =>
    getDefaultFloatingPanelPosition(
      typeof window === "undefined"
        ? CHAT_PANEL_BASE_HEIGHT
        : Math.min(CHAT_PANEL_BASE_HEIGHT, window.innerHeight - PANEL_EDGE_PADDING * 2),
    ),
  );
  const [settingsPanelPosition, setSettingsPanelPosition] = useState(() => getDefaultFloatingPanelPosition());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [swallowEnabled, setSwallowEnabled] = useState(initialSettingsRef.current.swallowEnabled);
  const [styleId, setStyleId] = useState(initialSettingsRef.current.styleId);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(initialSettingsRef.current.llm);
  const [draggedPaths, setDraggedPaths] = useState<string[]>([]);
  const [isSwallowHot, setIsSwallowHot] = useState(false);
  const [isSwallowing, setIsSwallowing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [systemNotifyGranted, setSystemNotifyGranted] = useState(false);
  const [windowFocused, setWindowFocused] = useState(true);
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const [memos, setMemos] = useState<MemoItem[]>(() => loadMemos());

  const petState: PetState = useMemo(() => {
    if (menuOpen || skillMenuOpen || memoPanelOpen || chatPanelOpen || settingsPanelOpen) return "active";
    return "idle";
  }, [menuOpen, skillMenuOpen, memoPanelOpen, chatPanelOpen, settingsPanelOpen]);

  const expRequired = useMemo(() => getExpRequired(progress.level), [progress.level]);
  const expPercent = Math.min((progress.exp / expRequired) * 100, 100);
  const maxMp = useMemo(() => getMaxMp(progress.level), [progress.level]);
  const mpPercent = Math.min((progress.mp / maxMp) * 100, 100);
  const isFileDragging = draggedPaths.length > 0;
  const activeStyle = useMemo(() => getStyleProfile(styleId), [styleId]);

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

  const closeConfirmDialog = (confirmed: boolean) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmDialog(null);
    if (resolver) resolver(confirmed);
  };

  const requestConfirmDialog = (nextDialog: ConfirmDialogState) => {
    setConfirmDialog(nextDialog);
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  };

  const requestSwallowConfirm = (count: number) => {
    return requestConfirmDialog({
      title: "确认吞噬",
      message: `确认将 ${count} 项移入回收站吗？`,
      confirmLabel: "确认",
      cancelLabel: "取消",
    });
  };

  const getDefaultMemoPosition = () => getDefaultFloatingPanelPosition(PANEL_BASE_HEIGHT);

  const getDefaultSkillPanelPosition = () => getDefaultMemoPosition();
  const getDefaultSettingsPanelPosition = () =>
    getDefaultFloatingPanelPosition(
      typeof window === "undefined"
        ? SETTINGS_PANEL_BASE_HEIGHT
        : Math.min(SETTINGS_PANEL_BASE_HEIGHT, window.innerHeight - PANEL_EDGE_PADDING * 2),
    );

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
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify({
            swallowEnabled,
            styleId,
            llm: normalizeLlmConfig(llmConfig),
          }),
        );
      } catch {
        // Ignore storage failures and keep runtime behavior stable.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [swallowEnabled, styleId, llmConfig]);

  useEffect(() => {
    applyStyleTokensToRoot(activeStyle.tokens);
  }, [activeStyle]);

  useEffect(() => {
    const contextMessageLimit = Math.max(1, Math.floor(llmConfig.contextTurns || 20)) * 2;
    setChatMessages((prev) => (prev.length > contextMessageLimit ? prev.slice(-contextMessageLimit) : prev));
  }, [llmConfig.contextTurns]);

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
              title: `${activeStyle.assistantName}备忘提醒`,
              body: remindMemoTitle,
            });
          } catch {
            // Keep in-app reminder as fallback.
          }
        }
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [systemNotifyGranted, activeStyle.assistantName]);

  useEffect(() => {
    swallowEnabledRef.current = swallowEnabled;
  }, [swallowEnabled]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    const bindDragDropListener = async () => {
      try {
        const off = await appWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === "enter") {
            if (!swallowEnabledRef.current) {
              setDraggedPaths([]);
              updateSwallowHot(false);
              return;
            }
            setDraggedPaths(event.payload.paths);
            updateSwallowHot(isPositionInsideSwallowZone(event.payload.position));
            return;
          }
          if (event.payload.type === "over") {
            if (!swallowEnabledRef.current) {
              updateSwallowHot(false);
              return;
            }
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
            if (!swallowEnabledRef.current) return;
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
        if (disposed) {
          off();
          return;
        }
        unlisten = off;
      } catch {
        setLastAction("吞噬功能初始化失败");
      }
    };

    void bindDragDropListener();
    return () => {
      disposed = true;
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
      if (unlisten) unlisten();
    };
  }, [appWindow]);

  useEffect(() => {
    if (swallowEnabled) return;
    setDraggedPaths([]);
    setIsSwallowHot(false);
    setIsSwallowing(false);
    swallowHotRef.current = false;
  }, [swallowEnabled]);

  useEffect(() => {
    let disposed = false;
    const syncWindowToMonitor = async () => {
      try {
        const monitor = await currentMonitor();
        if (!monitor || disposed) return;
        await appWindow.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y));
        await appWindow.setSize(new PhysicalSize(monitor.size.width, monitor.size.height));
      } catch {
        // Keep current size if API is unavailable.
      }
    };
    void syncWindowToMonitor();
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
    let metricsReady = false;
    let bootstrapInteractiveUntil = Date.now() + 1800;

    const isPointInsideInteractiveElements = (x: number, y: number) => {
      if (
        slimePointerRef.current ||
        memoDragRef.current ||
        skillPanelDragRef.current ||
        chatPanelDragRef.current ||
        settingsPanelDragRef.current
      ) {
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

      // Keep slime body and footer always interactive.
      appendTarget(slimeRef.current);
      appendTarget(footerRef.current);

      if (menuOpen && menuRingRef.current) {
        const menuButtons = menuRingRef.current.querySelectorAll<HTMLElement>(".menu-item");
        menuButtons.forEach((button) => appendTarget(button));
      }
      if (skillMenuOpen) {
        appendTarget(skillFanRef.current);
        if (skillFanRef.current) {
          const skillButtons = skillFanRef.current.querySelectorAll<HTMLElement>(".skill-fan-item");
          skillButtons.forEach((button) => appendTarget(button));
        }
      }
      if (memoPanelOpen) appendTarget(memoPanelRef.current);
      if (chatPanelOpen) appendTarget(chatPanelRef.current);
      if (settingsPanelOpen) appendTarget(settingsPanelRef.current);
      if (confirmDialog !== null) appendTarget(swallowConfirmDialogRef.current);

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
        metricsReady = true;
      } catch {
        // Keep last metrics and continue.
      }
    };

    const loop = async () => {
      if (disposed) return;
      try {
        if (!metricsReady) {
          await syncWindowMetrics();
        }
        const cursor = await cursorPosition();
        const shouldCapture =
          Date.now() < bootstrapInteractiveUntil || !metricsReady || isPointInsideInteractiveElements(cursor.x, cursor.y);
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

    const handleWindowFocus = () => {
      metricsReady = false;
      bootstrapInteractiveUntil = Date.now() + 800;
      void appWindow.setIgnoreCursorEvents(false).then(() => {
        lastIgnoreState = false;
      });
    };

    const init = async () => {
      await syncWindowMetrics();
      try {
        await appWindow.setIgnoreCursorEvents(false);
        lastIgnoreState = false;
      } catch {
        // Keep running even if pointer pass-through API is unavailable.
      }
      movedUnlisten = await appWindow.onMoved(({ payload }) => {
        windowPosRef.current = { x: payload.x, y: payload.y };
      });
      scaleUnlisten = await appWindow.onScaleChanged(({ payload }) => {
        windowScaleRef.current = payload.scaleFactor;
      });
      window.addEventListener("focus", handleWindowFocus);
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
      window.removeEventListener("focus", handleWindowFocus);
      void appWindow.setIgnoreCursorEvents(false);
    };
  }, [appWindow, menuOpen, skillMenuOpen, memoPanelOpen, chatPanelOpen, settingsPanelOpen, confirmDialog]);

  const toggleMenu = () => {
    setMenuOpen((prev) => {
      if (prev) {
        setSkillMenuOpen(false);
        if (!memoPinned) setMemoPanelOpen(false);
        setChatPanelOpen(false);
        setSettingsPanelOpen(false);
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

  const clearSlimePointerTracking = () => {
    if (slimeMoveListenerRef.current) {
      window.removeEventListener("mousemove", slimeMoveListenerRef.current);
      slimeMoveListenerRef.current = null;
    }
    if (slimeUpListenerRef.current) {
      window.removeEventListener("mouseup", slimeUpListenerRef.current);
      slimeUpListenerRef.current = null;
    }
  };

  const tryStartSlimeDragging = (clientX: number, clientY: number) => {
    const pointer = slimePointerRef.current;
    if (!pointer || pointer.moved) return;
    const deltaX = clientX - pointer.startX;
    const deltaY = clientY - pointer.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 4) return;
    pointer.moved = true;
    void appWindow.startDragging().catch(() => {
      // Keep click path available when drag cannot start.
    });
  };

  const handleSlimeMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    clearSlimePointerTracking();
    slimePointerRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    const onWindowMove = (moveEvent: MouseEvent) => {
      tryStartSlimeDragging(moveEvent.clientX, moveEvent.clientY);
    };
    const onWindowUp = (upEvent: MouseEvent) => {
      if (upEvent.button !== 0) return;
      handleSlimeMouseUp();
    };
    slimeMoveListenerRef.current = onWindowMove;
    slimeUpListenerRef.current = onWindowUp;
    window.addEventListener("mousemove", onWindowMove);
    window.addEventListener("mouseup", onWindowUp);
  };

  const handleSlimeMouseMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    tryStartSlimeDragging(event.clientX, event.clientY);
  };

  const handleSlimeMouseUp = () => {
    const pointer = slimePointerRef.current;
    clearSlimePointerTracking();
    if (!pointer) return;
    slimePointerRef.current = null;
    if (!pointer.moved) {
      triggerSlimeClickAction();
    }
  };

  useEffect(() => {
    return () => {
      clearSlimePointerTracking();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setProgress((prev) => applyMpRegen(prev, now));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const now = Date.now();
    setProgress((prev) => ({
      ...prev,
      mp: getMaxMp(prev.level),
      lastMpRegenAt: now,
    }));
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
    const openMemoWindow = async () => {
      try {
        let existing: WebviewWindow | null = null;
        try {
          existing = await WebviewWindow.getByLabel(MEMO_CHILD_WINDOW_LABEL);
        } catch {
          existing = null;
        }
        if (existing) {
          await existing.show();
          await existing.setFocus();
          setLastAction("激活备忘录子窗口");
          return;
        }

        const [outerPosition, scaleFactor] = await Promise.all([appWindow.outerPosition(), appWindow.scaleFactor()]);
        const slimeHeight = (SLIME_WIDTH * 254) / 366;
        const menuDiameter = MENU_BASE_SIZE * MENU_BOOST;
        const gap = menuDiameter * 0.75;
        const anchorX = window.innerWidth * SLIME_ANCHOR_X_RATIO;
        const anchorY = window.innerHeight * SLIME_ANCHOR_Y_RATIO;
        const defaultCenterX = anchorX - menuDiameter * 1.1;
        const defaultCenterY = anchorY - slimeHeight / 2 - gap;
        const logicalX = Math.round(outerPosition.x / scaleFactor + (defaultCenterX - MEMO_CHILD_WINDOW_WIDTH / 2));
        const logicalY = Math.round(outerPosition.y / scaleFactor + (defaultCenterY - MEMO_CHILD_WINDOW_HEIGHT / 2));

        const memoWindow = new WebviewWindow(MEMO_CHILD_WINDOW_LABEL, {
          url: "/?panel=memo",
          title: `${activeStyle.assistantName}备忘录`,
          x: logicalX,
          y: logicalY,
          width: MEMO_CHILD_WINDOW_WIDTH,
          height: MEMO_CHILD_WINDOW_HEIGHT,
          minWidth: MEMO_CHILD_WINDOW_WIDTH,
          minHeight: MEMO_CHILD_WINDOW_HEIGHT,
          alwaysOnTop: true,
          resizable: false,
          decorations: false,
          shadow: false,
          transparent: true,
          visible: true,
          focus: true,
        });

        memoWindow.once("tauri://error", (event) => {
          const detail = typeof event.payload === "string" ? event.payload : "未知错误";
          setToastText(`备忘录子窗口创建失败：${detail}`);
          setLastAction("备忘录子窗口创建失败");
        });
        setLastAction("打开备忘录子窗口");
      } catch (error) {
        const detail = error instanceof Error && error.message ? error.message : String(error);
        setToastText(`打开备忘录失败：${detail}`);
        setLastAction("打开备忘录子窗口失败");
      }
    };

    void openMemoWindow();
    setMemoPanelOpen(false);
    setSkillMenuOpen(false);
    setChatPanelOpen(false);
    setSettingsPanelOpen(false);
    setMenuOpen(false);
    setLastAction("打开备忘录子窗口");
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

  const removeMemo = async (memoId: string) => {
    const target = memos.find((memo) => memo.id === memoId);
    if (!target) return;
    if (!target.saved) {
      setMemos((prev) => prev.filter((memo) => memo.id !== memoId));
      setLastAction("删除草稿备忘录");
      return;
    }
    const label = target.title.trim() || "这条备忘录";
    const confirmed = await requestConfirmDialog({
      title: "确认删除",
      message: `确认删除“${label}”吗？`,
      confirmLabel: "确认",
      cancelLabel: "取消",
    });
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
      setMemoPosition(clampPanelPosition({
        x: moveEvent.clientX - memoDragRef.current.offsetX,
        y: moveEvent.clientY - memoDragRef.current.offsetY,
      }));
    };
    const handleUp = () => {
      memoDragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleSkillPanelHeaderMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    skillPanelDragRef.current = {
      offsetX: event.clientX - skillPanelPosition.x,
      offsetY: event.clientY - skillPanelPosition.y,
    };

    const handleMove = (moveEvent: MouseEvent) => {
      if (!skillPanelDragRef.current) return;
      setSkillPanelPosition(clampPanelPosition({
        x: moveEvent.clientX - skillPanelDragRef.current.offsetX,
        y: moveEvent.clientY - skillPanelDragRef.current.offsetY,
      }));
    };
    const handleUp = () => {
      skillPanelDragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleToggleSkills = () => {
    setSkillMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setSkillPanelPosition(getDefaultSkillPanelPosition());
        setChatPanelOpen(false);
        setSettingsPanelOpen(false);
      }
      return next;
    });
    setMenuOpen(false);
    setLastAction((prev) => (prev.includes("技能") ? "收起技能菜单" : "展开技能菜单"));
  };

  const handleOpenChat = () => {
    if (!llmConfig.enabled) {
      setToastText("聊天功能已关闭，请先在设置中开启 LLM 聊天。");
      setLastAction("聊天窗口打开失败：LLM 未启用");
      setMenuOpen(false);
      return;
    }
    const openChatWindow = async () => {
      try {
        const pushStyleToChatWindow = async (nextStyleId: string) => {
          try {
            const chatWindow = await WebviewWindow.getByLabel(CHAT_CHILD_WINDOW_LABEL);
            if (!chatWindow) return;
            await appWindow.emitTo(CHAT_CHILD_WINDOW_LABEL, "limulu:style-changed", { styleId: nextStyleId });
            await chatWindow.setTitle(`${getStyleProfile(nextStyleId).assistantName}聊天`);
          } catch {
            // Ignore style sync failures to avoid blocking chat window actions.
          }
        };
        let existing: WebviewWindow | null = null;
        try {
          existing = await WebviewWindow.getByLabel(CHAT_CHILD_WINDOW_LABEL);
        } catch {
          existing = null;
        }
        if (existing) {
          await existing.show();
          await existing.setFocus();
          await pushStyleToChatWindow(styleId);
          setLastAction("激活聊天子窗口");
          return;
        }

        const [outerPosition, scaleFactor] = await Promise.all([appWindow.outerPosition(), appWindow.scaleFactor()]);
        const slimeHeight = (SLIME_WIDTH * 254) / 366;
        const menuDiameter = MENU_BASE_SIZE * MENU_BOOST;
        const gap = menuDiameter * 0.75;
        const anchorX = window.innerWidth * SLIME_ANCHOR_X_RATIO;
        const anchorY = window.innerHeight * SLIME_ANCHOR_Y_RATIO;
        const defaultCenterX = anchorX + menuDiameter * 1.1;
        const defaultCenterY = anchorY - slimeHeight / 2 - gap;
        const logicalX = Math.round(outerPosition.x / scaleFactor + (defaultCenterX - CHAT_CHILD_WINDOW_WIDTH / 2));
        const logicalY = Math.round(outerPosition.y / scaleFactor + (defaultCenterY - CHAT_CHILD_WINDOW_HEIGHT / 2));

        const chatWindow = new WebviewWindow(CHAT_CHILD_WINDOW_LABEL, {
          url: `/?panel=chat&styleId=${encodeURIComponent(styleId)}`,
          title: `${activeStyle.assistantName}聊天`,
          x: logicalX,
          y: logicalY,
          width: CHAT_CHILD_WINDOW_WIDTH,
          height: CHAT_CHILD_WINDOW_HEIGHT,
          minWidth: 560,
          minHeight: 700,
          alwaysOnTop: true,
          resizable: false,
          decorations: false,
          shadow: false,
          transparent: true,
          visible: true,
          focus: true,
        });

        chatWindow.once("tauri://error", (event) => {
          const detail = typeof event.payload === "string" ? event.payload : "未知错误";
          setToastText(`聊天子窗口创建失败：${detail}`);
          setLastAction("聊天子窗口创建失败");
        });
        setLastAction("打开聊天子窗口");
      } catch (error) {
        const detail = error instanceof Error && error.message ? error.message : String(error);
        setToastText(`打开聊天窗口失败：${detail}`);
        setLastAction("打开聊天子窗口失败");
      }
    };

    void openChatWindow();
    setChatPanelOpen(false);
    setSkillMenuOpen(false);
    setSettingsPanelOpen(false);
    setMenuOpen(false);
    setLastAction("打开聊天子窗口");
  };

  const handleToggleSettings = () => {
    setSettingsPanelOpen((prev) => {
      const next = !prev;
      if (next) {
        setSettingsPanelPosition(getDefaultSettingsPanelPosition());
        setSkillMenuOpen(false);
        setChatPanelOpen(false);
      }
      return next;
    });
    setMenuOpen(false);
    setLastAction((prev) => (prev.includes("设置") ? "关闭设置面板" : "打开设置面板"));
  };

  const handleChatHeaderMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    chatPanelDragRef.current = {
      offsetX: event.clientX - chatPanelPosition.x,
      offsetY: event.clientY - chatPanelPosition.y,
    };

    const handleMove = (moveEvent: MouseEvent) => {
      if (!chatPanelDragRef.current) return;
      setChatPanelPosition({
        x: moveEvent.clientX - chatPanelDragRef.current.offsetX,
        y: moveEvent.clientY - chatPanelDragRef.current.offsetY,
      });
    };
    const handleUp = () => {
      chatPanelDragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleSettingsHeaderMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    settingsPanelDragRef.current = {
      offsetX: event.clientX - settingsPanelPosition.x,
      offsetY: event.clientY - settingsPanelPosition.y,
    };

    const handleMove = (moveEvent: MouseEvent) => {
      if (!settingsPanelDragRef.current) return;
      setSettingsPanelPosition(
        clampPanelPosition({
          x: moveEvent.clientX - settingsPanelDragRef.current.offsetX,
          y: moveEvent.clientY - settingsPanelDragRef.current.offsetY,
        }, {
          panelWidth: Math.min(SETTINGS_PANEL_BASE_WIDTH, window.innerWidth - PANEL_EDGE_PADDING * 2),
          panelHeight: Math.min(SETTINGS_PANEL_BASE_HEIGHT, window.innerHeight - PANEL_EDGE_PADDING * 2),
        }),
      );
    };
    const handleUp = () => {
      settingsPanelDragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    if (!llmConfig.enabled) {
      setToastText("请先在设置中开启 LLM 聊天。");
      setLastAction("聊天发送失败：LLM 未启用");
      return;
    }
    if (!llmConfig.baseUrl.trim() || !llmConfig.model.trim() || !llmConfig.apiKey.trim()) {
      setToastText("请先补全 LLM 配置（Base URL / 模型 / API Key）。");
      setLastAction("聊天发送失败：配置不完整");
      return;
    }
    const contextMessageLimit = Math.max(1, Math.floor(llmConfig.contextTurns || 20)) * 2;
    const trimHistory = (history: ChatMessage[]) => history.slice(-contextMessageLimit);
    const userMessage = createChatMessage("user", text);
    const nextHistory = trimHistory([...chatMessages, userMessage]);
    setChatSending(true);
    setChatMessages(nextHistory);
    setChatInput("");
    setLastAction("发送聊天消息");
    try {
      const reply = await requestLlmReply(llmConfig, nextHistory);
      setChatMessages((prev) => trimHistory([...prev, createChatMessage("assistant", reply)]));
      setLastAction("收到聊天回复");
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "请求失败，请检查网络或配置。";
      const detailMessage = [
        "请求失败，以下是排查信息：",
        `- 请求地址：${llmConfig.baseUrl.trim() || "(未配置)"}`,
        `- 模型：${llmConfig.model.trim() || "(未配置)"}`,
        "",
        message,
      ].join("\n");
      setChatMessages((prev) => trimHistory([...prev, createChatMessage("assistant", detailMessage)]));
      setLastAction("聊天请求失败");
    } finally {
      setChatSending(false);
    }
  };

  const handleClearChatContext = () => {
    setChatMessages([]);
    setLastAction("清空聊天上下文");
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
  );
  const memoPanelLayer = typeof document === "undefined" ? memoPanelNode : createPortal(memoPanelNode, document.body);
  const chatPanelNode = (
    <ChatPanel
      open={chatPanelOpen}
      position={chatPanelPosition}
      chatPanelRef={chatPanelRef}
      onHeaderMouseDown={handleChatHeaderMouseDown}
      messages={chatMessages}
      input={chatInput}
      isSending={chatSending}
      assistantName={activeStyle.assistantName}
      thinkingGif={activeStyle.thinkingGif}
      onInputChange={setChatInput}
      onSend={handleSendChat}
      onClearContext={handleClearChatContext}
      onClose={() => {
        setChatPanelOpen(false);
        setLastAction("关闭聊天面板");
      }}
    />
  );
  const chatPanelLayer = typeof document === "undefined" ? chatPanelNode : createPortal(chatPanelNode, document.body);
  const settingsPanelNode = (
    <SettingsPanel
      open={settingsPanelOpen}
      position={settingsPanelPosition}
      settingsPanelRef={settingsPanelRef}
      onHeaderMouseDown={handleSettingsHeaderMouseDown}
      swallowEnabled={swallowEnabled}
      onToggleSwallow={() => {
        setSwallowEnabled((prev) => {
          const next = !prev;
          setLastAction(next ? "开启吞噬功能" : "关闭吞噬功能");
          setToastText(next ? "吞噬功能已开启" : "吞噬功能已关闭");
          return next;
        });
      }}
      styleOptions={STYLE_PROFILES.map((styleProfile) => ({
        id: styleProfile.id,
        label: styleProfile.label,
      }))}
      styleId={styleId}
      onStyleChange={(nextStyleId: string) => {
        const currentStyle = getStyleProfile(styleId);
        const nextStyle = getStyleProfile(nextStyleId);
        setStyleId(nextStyleId);
        void (async () => {
          try {
            const chatWindow = await WebviewWindow.getByLabel(CHAT_CHILD_WINDOW_LABEL);
            if (!chatWindow) return;
            await appWindow.emitTo(CHAT_CHILD_WINDOW_LABEL, "limulu:style-changed", { styleId: nextStyleId });
            await chatWindow.setTitle(`${nextStyle.assistantName}聊天`);
          } catch {
            // Ignore if child window is not running or temporarily unavailable.
          }
        })();
        setLlmConfig((prev) => {
          const canReplacePrompt =
            !prev.systemPrompt.trim() || prev.systemPrompt.trim() === currentStyle.defaultSystemPrompt.trim();
          if (!canReplacePrompt) return prev;
          return normalizeLlmConfig({
            ...prev,
            systemPrompt: nextStyle.defaultSystemPrompt,
          });
        });
      }}
      llmConfig={llmConfig}
      onUpdateLlmConfig={(patch) => setLlmConfig((prev) => normalizeLlmConfig({ ...prev, ...patch }))}
      onClose={() => {
        setSettingsPanelOpen(false);
        setLastAction("关闭设置面板");
      }}
    />
  );
  const settingsPanelLayer = typeof document === "undefined" ? settingsPanelNode : createPortal(settingsPanelNode, document.body);
  const skillPanelNode = (
    <SkillFan
      open={skillMenuOpen}
      skillFanRef={skillFanRef}
      position={skillPanelPosition}
      onHeaderMouseDown={handleSkillPanelHeaderMouseDown}
      onClose={() => {
        setSkillMenuOpen(false);
        setLastAction("收起技能菜单");
      }}
      onCastSkill={castSkill}
    />
  );
  const skillPanelLayer = typeof document === "undefined" ? skillPanelNode : createPortal(skillPanelNode, document.body);
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
            onOpenChat={handleOpenChat}
            onOpenSettings={handleToggleSettings}
            onFallbackClick={(label) => setLastAction(`点击${label}`)}
          />
          <div
            className={`swallow-zone ${swallowEnabled && (isFileDragging || SHOW_SWALLOW_DEBUG) ? "visible" : ""} ${isSwallowHot ? "hot" : ""} ${isSwallowing ? "swallowing" : ""}`}
            ref={swallowZoneRef}
            aria-hidden="true"
          />

          <button
            className={`slime-btn state-${petState} ${isBouncing ? "is-bouncing" : ""}`}
            style={
              {
                "--style-main-scale": `${activeStyle.mainImageScale}`,
                "--style-main-gloss-opacity": `${activeStyle.mainGlossOpacity}`,
                "--style-main-gloss-bg": activeStyle.mainGlossBackground,
                "--style-main-image-filter": activeStyle.mainImageFilter,
                "--style-main-button-filter": activeStyle.mainButtonFilter,
                "--style-main-button-hover-filter": activeStyle.mainButtonHoverFilter,
                "--style-main-idle-animation": activeStyle.mainIdleAnimation,
                "--style-main-image-idle-animation": activeStyle.mainImageIdleAnimation,
                "--style-main-gloss-animation": activeStyle.mainGlossAnimation,
              } as CSSProperties
            }
            onMouseDown={handleSlimeMouseDown}
            onMouseMove={handleSlimeMouseMove}
            onMouseUp={handleSlimeMouseUp}
            onMouseLeave={handleSlimeMouseUp}
            onClick={(event) => event.preventDefault()}
            aria-label={`${activeStyle.assistantName}主按钮`}
            ref={slimeRef}
          >
            <img src={activeStyle.mainImage} className="slime-image" alt={`${activeStyle.assistantName}形态`} />
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
      {skillPanelLayer}
      {chatPanelLayer}
      {settingsPanelLayer}
      {confirmDialog !== null && (
        <div className="swallow-confirm-overlay">
          <div
            className="swallow-confirm-dialog"
            ref={swallowConfirmDialogRef}
            style={swallowConfirmDialogStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="swallow-confirm-title">{confirmDialog.title}</div>
            <div className="swallow-confirm-text">{confirmDialog.message}</div>
            <div className="swallow-confirm-actions">
              <button type="button" className="swallow-confirm-btn cancel" onClick={() => closeConfirmDialog(false)}>
                {confirmDialog.cancelLabel}
              </button>
              <button type="button" className="swallow-confirm-btn confirm" onClick={() => closeConfirmDialog(true)}>
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
