import { SETTINGS_STORAGE_KEY } from "../constants/app";
import { DEFAULT_STYLE_ID, getStyleProfile, normalizeStyleId } from "../styles/profiles";
import type { AppSettings, LlmConfig } from "../types/app";

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: true,
  minimalCompatibleMode: true,
  contextTurns: 20,
  stream: true,
  apiStyle: "openai-compatible",
  provider: "openai",
  openaiApiMode: "chat",
  baseUrl: "https://it-ai.fineres.com/v1",
  apiKey: "",
  model: "gpt-5.3-codex",
  systemPrompt: getStyleProfile(DEFAULT_STYLE_ID).defaultSystemPrompt,
  temperature: 0.7,
  topP: 1,
  n: 1,
  stop: "",
  presencePenalty: 0,
  frequencyPenalty: 0,
  maxCompletionTokens: 0,
  user: "",
  maxTokens: 512,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  swallowEnabled: true,
  styleId: DEFAULT_STYLE_ID,
  llm: DEFAULT_LLM_CONFIG,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function normalizeLlmConfig(config: Partial<LlmConfig> | undefined): LlmConfig {
  const merged: LlmConfig = {
    ...DEFAULT_LLM_CONFIG,
    ...(config ?? {}),
  };
  const normalizedProvider = merged.provider === "openai" || merged.provider === "custom" || merged.provider === "claudecode"
    ? merged.provider
    : "custom";
  const normalizedApiStyle =
    normalizedProvider === "claudecode"
      ? "claude-code"
      : merged.apiStyle === "custom"
        ? "custom"
      : merged.apiStyle === "claude-code"
        ? "claude-code"
        : "openai-compatible";

  return {
    enabled: Boolean(merged.enabled),
    minimalCompatibleMode: Boolean(merged.minimalCompatibleMode),
    contextTurns: clamp(Number.isFinite(merged.contextTurns) ? Math.floor(merged.contextTurns) : DEFAULT_LLM_CONFIG.contextTurns, 1, 50),
    stream: Boolean(merged.stream),
    apiStyle: normalizedApiStyle,
    provider: normalizedProvider,
    openaiApiMode: "chat",
    baseUrl: (merged.baseUrl || "").trim(),
    apiKey: merged.apiKey || "",
    model: (merged.model || "").trim(),
    systemPrompt: merged.systemPrompt || "",
    temperature: clamp(Number.isFinite(merged.temperature) ? merged.temperature : DEFAULT_LLM_CONFIG.temperature, 0, 2),
    topP: clamp(Number.isFinite(merged.topP) ? merged.topP : DEFAULT_LLM_CONFIG.topP, 0, 1),
    n: clamp(Number.isFinite(merged.n) ? Math.floor(merged.n) : DEFAULT_LLM_CONFIG.n, 1, 8),
    stop: typeof merged.stop === "string" ? merged.stop : "",
    presencePenalty: clamp(
      Number.isFinite(merged.presencePenalty) ? merged.presencePenalty : DEFAULT_LLM_CONFIG.presencePenalty,
      -2,
      2,
    ),
    frequencyPenalty: clamp(
      Number.isFinite(merged.frequencyPenalty) ? merged.frequencyPenalty : DEFAULT_LLM_CONFIG.frequencyPenalty,
      -2,
      2,
    ),
    maxCompletionTokens: clamp(
      Number.isFinite(merged.maxCompletionTokens) ? Math.floor(merged.maxCompletionTokens) : DEFAULT_LLM_CONFIG.maxCompletionTokens,
      0,
      8192,
    ),
    user: typeof merged.user === "string" ? merged.user : "",
    maxTokens: clamp(Number.isFinite(merged.maxTokens) ? Math.floor(merged.maxTokens) : DEFAULT_LLM_CONFIG.maxTokens, 1, 8192),
  };
}

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings> & { swallowEnabled?: boolean };
    return {
      swallowEnabled: typeof parsed.swallowEnabled === "boolean" ? parsed.swallowEnabled : true,
      styleId: normalizeStyleId(parsed.styleId),
      llm: normalizeLlmConfig(parsed.llm),
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}
