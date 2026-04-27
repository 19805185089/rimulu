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

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export type LlmProvider = "openai" | "custom" | "claudecode";
export type OpenAiApiMode = "chat" | "responses";
export type LlmApiStyle = "openai-compatible" | "claude-code" | "custom";

export type LlmConfig = {
  enabled: boolean;
  minimalCompatibleMode: boolean;
  contextTurns: number;
  stream: boolean;
  apiStyle: LlmApiStyle;
  provider: LlmProvider;
  openaiApiMode: OpenAiApiMode;
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  n: number;
  stop: string;
  presencePenalty: number;
  frequencyPenalty: number;
  maxCompletionTokens: number;
  user: string;
  maxTokens: number;
};

export type AppSettings = {
  swallowEnabled: boolean;
  styleId: string;
  llm: LlmConfig;
};

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
};
