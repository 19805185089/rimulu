import { useEffect, useMemo, useRef, useState } from "react";
import { cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";
import ChatPanel from "./components/ChatPanel";
import { INTERACTIVE_HIT_PADDING, SETTINGS_STORAGE_KEY } from "./constants/app";
import { createHatchPetStyleProfile, getStyleProfile, normalizeStyleId, STYLE_PROFILES } from "./styles/profiles";
import { applyStyleTokensToRoot } from "./styles/theme";
import { HATCH_PETS_STORAGE_KEY, loadInstalledHatchPets } from "./utils/hatchPets";
import { loadAppSettings, normalizeLlmConfig, resolveSystemPromptForStyle } from "./utils/settings";
import { requestLlmReply } from "./utils/llm";
import type { ChatMessage } from "./types/app";
import type { StyleProfile } from "./styles/profiles";
import "./App.css";

const createChatMessage = (role: "user" | "assistant", content: string): ChatMessage => ({
  id:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `chat-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  role,
  content,
  createdAt: Date.now(),
});

const getStyleIdFromQuery = () => {
  if (typeof window === "undefined") return undefined;
  const value = new URLSearchParams(window.location.search).get("styleId");
  return value && value.trim() ? value : undefined;
};

export default function ChatWindowApp() {
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const chatPanelRef = useRef<HTMLElement | null>(null);
  const windowPosRef = useRef({ x: 0, y: 0 });
  const windowScaleRef = useRef(1);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [draggingWindow, setDraggingWindow] = useState(false);
  const [styleId, setStyleId] = useState(() => normalizeStyleId(getStyleIdFromQuery() ?? loadAppSettings().styleId));
  const [hatchPetStyles, setHatchPetStyles] = useState<StyleProfile[]>([]);
  const [llmConfig, setLlmConfig] = useState(() => {
    const settings = loadAppSettings();
    const initialStyleId = normalizeStyleId(getStyleIdFromQuery() ?? settings.styleId);
    return normalizeLlmConfig({
      ...settings.llm,
      systemPrompt: resolveSystemPromptForStyle(initialStyleId, settings.stylePrompts),
    });
  });
  const styleProfiles = useMemo(() => [...STYLE_PROFILES, ...hatchPetStyles], [hatchPetStyles]);
  const activeStyle = useMemo(
    () => styleProfiles.find((styleProfile) => styleProfile.id === styleId) ?? getStyleProfile(styleId),
    [styleId, styleProfiles],
  );
  const panelPosition = useMemo(() => {
    if (typeof window === "undefined") return { x: 390, y: 460 };
    const panelWidth = Math.min(630 * 1.2, window.innerWidth - 20);
    const panelHeight = Math.min(840 * 1.2, window.innerHeight - 20);
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
    const syncSettings = (targetStyleId = styleId) => {
      const normalizedTargetStyleId = normalizeStyleId(targetStyleId);
      const settings = loadAppSettings();
      const targetStyle = styleProfiles.find((styleProfile) => styleProfile.id === normalizedTargetStyleId) ?? getStyleProfile(normalizedTargetStyleId);
      const systemPrompt = settings.stylePrompts[normalizedTargetStyleId] || targetStyle.defaultSystemPrompt;
      const nextLlmConfig = normalizeLlmConfig({
        ...settings.llm,
        systemPrompt,
      });
      setLlmConfig((prev) => (JSON.stringify(prev) === JSON.stringify(nextLlmConfig) ? prev : nextLlmConfig));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== SETTINGS_STORAGE_KEY) return;
      syncSettings();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncSettings();
      }
    };
    const handleFocus = () => {
      syncSettings();
    };
    const timer = window.setInterval(syncSettings, 700);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [styleId, styleProfiles]);

  useEffect(() => {
    applyStyleTokensToRoot(activeStyle.tokens);
  }, [activeStyle]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const bindStyleSyncEvent = async () => {
      unlisten = await appWindow.listen<{ styleId?: string }>("limulu:style-changed", (event) => {
        if (cancelled) return;
        const nextStyleId = event.payload?.styleId;
        if (!nextStyleId) return;
        const normalizedNextStyleId = normalizeStyleId(nextStyleId);
        setStyleId((prev) => (prev === normalizedNextStyleId ? prev : normalizedNextStyleId));
        const settings = loadAppSettings();
        const nextStyle = styleProfiles.find((styleProfile) => styleProfile.id === normalizedNextStyleId) ?? getStyleProfile(normalizedNextStyleId);
        setLlmConfig((prev) => {
          const nextLlmConfig = normalizeLlmConfig({
            ...settings.llm,
            systemPrompt: settings.stylePrompts[normalizedNextStyleId] || nextStyle.defaultSystemPrompt,
          });
          return JSON.stringify(prev) === JSON.stringify(nextLlmConfig) ? prev : nextLlmConfig;
        });
      });
    };

    void bindStyleSyncEvent();
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [appWindow, styleProfiles]);

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
      const panel = chatPanelRef.current;
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

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    if (!llmConfig.enabled) {
      setChatMessages((prev) => [...prev, createChatMessage("assistant", "请先在设置中开启 LLM 聊天。")]);
      return;
    }
    if (!llmConfig.baseUrl.trim() || !llmConfig.model.trim() || !llmConfig.apiKey.trim()) {
      setChatMessages((prev) => [
        ...prev,
        createChatMessage("assistant", "请先补全 LLM 配置（Base URL / 模型 / API Key）。"),
      ]);
      return;
    }

    const contextMessageLimit = Math.max(1, Math.floor(llmConfig.contextTurns || 20)) * 2;
    const trimHistory = (history: ChatMessage[]) => history.slice(-contextMessageLimit);
    const userMessage = createChatMessage("user", text);
    const nextHistory = trimHistory([...chatMessages, userMessage]);
    setChatSending(true);
    setChatMessages(nextHistory);
    setChatInput("");

    try {
      const reply = await requestLlmReply(llmConfig, nextHistory);
      setChatMessages((prev) => trimHistory([...prev, createChatMessage("assistant", reply)]));
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
    } finally {
      setChatSending(false);
    }
  };

  return (
    <main className="pet-app">
      <ChatPanel
        open
        position={panelPosition}
        chatPanelRef={chatPanelRef}
        onHeaderMouseDown={(event) => {
          if (event.button !== 0) return;
          setDraggingWindow(true);
          event.preventDefault();
          void appWindow.startDragging();
        }}
        messages={chatMessages}
        input={chatInput}
        isSending={chatSending}
        assistantName={activeStyle.assistantName}
        thinkingGif={activeStyle.thinkingGif}
        hatchPet={activeStyle.hatchPet}
        onInputChange={setChatInput}
        onSend={handleSendChat}
        onClearContext={() => setChatMessages([])}
        onClose={() => {
          void appWindow.hide();
        }}
      />
    </main>
  );
}
