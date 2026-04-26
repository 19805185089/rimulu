import type { ChatMessage, LlmApiStyle, LlmConfig } from "../types/app";

type OpenAiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAiAssistantMessage = {
  reasoning_content?: string;
  refusal?: string;
  tool_calls?: Array<{
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  content?:
    | string
    | { type?: string; text?: string; content?: string }
    | Array<string | { type?: string; text?: string; content?: string }>
    | null;
};

type OpenAiResponseShape = {
  id?: string;
  output_text?: string;
  output?: unknown;
  response?: unknown;
  type?: string;
  delta?: unknown;
  choices?: Array<{
    text?: string;
    delta?: {
      content?: string;
      reasoning_content?: string;
      refusal?: string;
      tool_calls?: Array<{
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    message?: OpenAiAssistantMessage;
  }>;
  error?: {
    message?: string;
  };
};

type ClaudeResponseShape = {
  type?: string;
  delta?: {
    type?: string;
    text?: string;
  };
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

type RequestContext = {
  config: LlmConfig;
  recentHistory: OpenAiMessage[];
  latestUserText: string;
  streamEnabled: boolean;
  stop?: string | string[];
};

type Adapter = {
  style: LlmApiStyle;
  endpointSuffix: string;
  modeLabel: string;
  buildHeaders: (config: LlmConfig) => Record<string, string>;
  buildAttemptPayloads: (context: RequestContext) => Record<string, unknown>[];
  extractNonStreamText: (data: unknown) => string;
  extractStreamText: (data: unknown) => string;
  getErrorMessage: (data: unknown) => string;
};

const MAX_RAW_ERROR_LENGTH = 4000;

const takeRawError = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= MAX_RAW_ERROR_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_RAW_ERROR_LENGTH)}\n...(错误内容过长，已截断)`;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return "请求失败，请检查网络或配置。";
};

const toDebugSnippet = (data: unknown) => {
  try {
    const json = JSON.stringify(data);
    if (!json) return "";
    if (json.length <= 1800) return json;
    return `${json.slice(0, 1800)}...(内容过长，已截断)`;
  } catch {
    return "";
  }
};

const extractText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((part) => extractText(part))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const byText = extractText(record.text);
    if (byText) return byText;
    const byValue = extractText(record.value);
    if (byValue) return byValue;
    const byOutputText = extractText(record.output_text);
    if (byOutputText) return byOutputText;
    const byRefusal = extractText(record.refusal);
    if (byRefusal) return byRefusal;
    const byContent = extractText(record.content);
    if (byContent) return byContent;
  }
  return "";
};

const buildStop = (raw: string): string | string[] | undefined => {
  const normalized = raw
    .split(/\r?\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (normalized.length === 0) return undefined;
  if (normalized.length === 1) return normalized[0];
  return normalized;
};

const withoutStream = (payload: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...payload };
  delete next.stream;
  return next;
};

const pushUniquePayload = (list: Record<string, unknown>[], payload: Record<string, unknown>) => {
  const signature = JSON.stringify(payload);
  const exists = list.some((item) => JSON.stringify(item) === signature);
  if (!exists) list.push(payload);
};

const toEndpoint = (baseUrl: string, endpointSuffix: string) => {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedSuffix = endpointSuffix.replace(/^\/+/, "");
  if (!trimmedSuffix) return trimmedBase;
  return `${trimmedBase}/${trimmedSuffix}`;
};

const extractToolCallsText = (value: unknown) => {
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((call) => {
      if (!call || typeof call !== "object") return [];
      const fn = (call as { function?: { name?: string; arguments?: string } }).function;
      if (!fn) return [];
      return [fn.name, fn.arguments];
    })
    .map((item) => extractText(item))
    .filter(Boolean)
    .join("\n")
    .trim();
};

const extractMessageExtras = (message: OpenAiAssistantMessage | undefined) => {
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  return [record.reasoning_content, record.refusal, extractToolCallsText(record.tool_calls)]
    .map((item) => extractText(item))
    .filter(Boolean)
    .join("\n")
    .trim();
};

const extractResponsesOutputText = (data: OpenAiResponseShape) => {
  const root = data as Record<string, unknown>;
  const output = root.output;
  const parsedOutput = extractText(output);
  if (parsedOutput) return parsedOutput;

  const responseOutput =
    root.response && typeof root.response === "object" ? (root.response as Record<string, unknown>).output : undefined;
  const parsedResponseOutput = extractText(responseOutput);
  if (parsedResponseOutput) return parsedResponseOutput;

  return "";
};

const extractOpenAiText = (data: OpenAiResponseShape, preferDelta = false) => {
  const firstChoice = data.choices?.[0];
  if (preferDelta) {
    if (typeof firstChoice?.delta?.content === "string") return firstChoice.delta.content;
    if (typeof data.delta === "string") return data.delta;
  }

  const deltaRecord = firstChoice?.delta as Record<string, unknown> | undefined;
  const deltaExtras = deltaRecord
    ? [deltaRecord.reasoning_content, deltaRecord.refusal, extractToolCallsText(deltaRecord.tool_calls)]
        .map((item) => extractText(item))
        .filter(Boolean)
        .join("\n")
        .trim()
    : "";
  const messageExtras = extractMessageExtras(firstChoice?.message);
  const responseRecord = data.response && typeof data.response === "object" ? (data.response as Record<string, unknown>) : undefined;
  const responsesOutputText = extractResponsesOutputText(data);
  const candidates: unknown[] = preferDelta
    ? [
        firstChoice?.delta?.content,
        data.delta,
        deltaExtras,
        firstChoice?.message?.content,
        firstChoice?.text,
        messageExtras,
        data.output_text,
        data.output,
        responseRecord?.output_text,
        responseRecord?.output,
        responsesOutputText,
      ]
    : [
        firstChoice?.message?.content,
        firstChoice?.text,
        firstChoice?.delta?.content,
        data.delta,
        deltaExtras,
        messageExtras,
        data.output_text,
        data.output,
        responseRecord?.output_text,
        responseRecord?.output,
        responsesOutputText,
      ];
  for (const candidate of candidates) {
    const parsed = extractText(candidate);
    if (parsed) return parsed;
  }
  return "";
};

const toResponsesInputMessages = (
  source: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>,
  structured = false,
) =>
  source.map((item) => ({
    role: item.role,
    content: structured ? [{ type: "input_text", text: item.content }] : item.content,
  }));

const toClaudeMessages = (
  source: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>,
) =>
  source
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content,
    }));

const openAiAdapter: Adapter = {
  style: "openai-compatible",
  endpointSuffix: "chat/completions",
  modeLabel: "OpenAI Chat Completions",
  buildHeaders: (config) => ({
    ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
  }),
  buildAttemptPayloads: (context) => {
    const { config, recentHistory, latestUserText, streamEnabled, stop } = context;
    const responsesMode = config.provider === "openai" && config.openaiApiMode === "responses";
    const systemPrompt = config.systemPrompt.trim();
    const messages: OpenAiMessage[] = systemPrompt ? [{ role: "system", content: systemPrompt }, ...recentHistory] : recentHistory;
    const strictMinimalPayload = responsesMode
      ? {
          model: config.model.trim(),
          input: latestUserText,
          ...(streamEnabled ? { stream: true } : {}),
        }
      : {
          model: config.model.trim(),
          messages: [{ role: "user", content: latestUserText }],
          ...(streamEnabled ? { stream: true } : {}),
        };
    const compatibleFallbackPayload = responsesMode
      ? {
          model: config.model.trim(),
          input: toResponsesInputMessages(recentHistory),
          ...(systemPrompt ? { instructions: systemPrompt } : {}),
          ...(streamEnabled ? { stream: true } : {}),
        }
      : {
          model: config.model.trim(),
          messages,
          ...(streamEnabled ? { stream: true } : {}),
        };
    const payload = config.minimalCompatibleMode
      ? { ...compatibleFallbackPayload }
      : responsesMode
        ? {
            model: config.model.trim(),
            input: toResponsesInputMessages(recentHistory),
            ...(systemPrompt ? { instructions: systemPrompt } : {}),
            temperature: config.temperature,
            top_p: config.topP,
            max_output_tokens: config.maxCompletionTokens > 0 ? config.maxCompletionTokens : config.maxTokens,
            stream: streamEnabled,
          }
        : {
            model: config.model.trim(),
            messages,
            temperature: config.temperature,
            top_p: config.topP,
            n: config.n,
            ...(stop ? { stop } : {}),
            presence_penalty: config.presencePenalty,
            frequency_penalty: config.frequencyPenalty,
            ...(config.user.trim() ? { user: config.user.trim() } : {}),
            ...(config.maxCompletionTokens > 0
              ? { max_completion_tokens: config.maxCompletionTokens }
              : { max_tokens: config.maxTokens }),
            stream: streamEnabled,
          };

    const attemptPayloads: Record<string, unknown>[] = [];
    pushUniquePayload(attemptPayloads, payload);
    if (responsesMode) {
      pushUniquePayload(attemptPayloads, {
        model: config.model.trim(),
        input: toResponsesInputMessages([{ role: "user", content: latestUserText }]),
        ...(streamEnabled ? { stream: true } : {}),
      });
      pushUniquePayload(attemptPayloads, {
        model: config.model.trim(),
        input: toResponsesInputMessages([{ role: "user", content: latestUserText }], true),
        ...(streamEnabled ? { stream: true } : {}),
      });
    }
    if (!config.minimalCompatibleMode) {
      pushUniquePayload(attemptPayloads, compatibleFallbackPayload);
      pushUniquePayload(attemptPayloads, strictMinimalPayload);
    }
    if (streamEnabled) {
      for (const item of [...attemptPayloads]) {
        if (Object.prototype.hasOwnProperty.call(item, "stream")) {
          pushUniquePayload(attemptPayloads, withoutStream(item));
        }
      }
    }
    return attemptPayloads;
  },
  extractNonStreamText: (data) => extractOpenAiText(data as OpenAiResponseShape),
  extractStreamText: (data) => {
    const parsed = data as OpenAiResponseShape;
    if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
      return parsed.delta;
    }
    return extractOpenAiText(parsed, true);
  },
  getErrorMessage: (data) => {
    const parsed = data as OpenAiResponseShape;
    return parsed.error?.message?.trim() || "";
  },
};

const claudeCodeAdapter: Adapter = {
  style: "claude-code",
  endpointSuffix: "messages",
  modeLabel: "Claude Code Messages",
  buildHeaders: (config) => ({
    ...(config.apiKey.trim()
      ? {
          Authorization: `Bearer ${config.apiKey.trim()}`,
          "x-api-key": config.apiKey.trim(),
        }
      : {}),
    "anthropic-version": "2023-06-01",
  }),
  buildAttemptPayloads: (context) => {
    const { config, recentHistory, latestUserText, streamEnabled, stop } = context;
    const fullMessages = toClaudeMessages(recentHistory);
    const maxTokens = config.maxCompletionTokens > 0 ? config.maxCompletionTokens : config.maxTokens;
    const fullPayload: Record<string, unknown> = {
      model: config.model.trim(),
      messages: fullMessages.length > 0 ? fullMessages : [{ role: "user", content: latestUserText }],
      max_tokens: maxTokens,
      stream: streamEnabled,
      ...(config.systemPrompt.trim() ? { system: config.systemPrompt.trim() } : {}),
      ...(config.minimalCompatibleMode
        ? {}
        : {
            temperature: config.temperature,
            top_p: config.topP,
            ...(stop ? { stop_sequences: Array.isArray(stop) ? stop : [stop] } : {}),
          }),
    };
    const strictMinimalPayload: Record<string, unknown> = {
      model: config.model.trim(),
      messages: [{ role: "user", content: latestUserText }],
      max_tokens: maxTokens,
      ...(streamEnabled ? { stream: true } : {}),
    };
    const attemptPayloads: Record<string, unknown>[] = [];
    pushUniquePayload(attemptPayloads, fullPayload);
    pushUniquePayload(attemptPayloads, strictMinimalPayload);
    if (streamEnabled) {
      for (const item of [...attemptPayloads]) {
        if (Object.prototype.hasOwnProperty.call(item, "stream")) {
          pushUniquePayload(attemptPayloads, withoutStream(item));
        }
      }
    }
    return attemptPayloads;
  },
  extractNonStreamText: (data) => {
    const parsed = data as ClaudeResponseShape;
    const fromContent = extractText(parsed.content);
    if (fromContent) return fromContent;
    return extractText(data);
  },
  extractStreamText: (data) => {
    const parsed = data as ClaudeResponseShape;
    if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
      return parsed.delta.text ?? "";
    }
    return "";
  },
  getErrorMessage: (data) => {
    const parsed = data as ClaudeResponseShape;
    return parsed.error?.message?.trim() || "";
  },
};

const ADAPTERS: Record<LlmApiStyle, Adapter> = {
  "openai-compatible": openAiAdapter,
  "claude-code": claudeCodeAdapter,
  custom: openAiAdapter,
};

const resolveApiStyle = (config: LlmConfig): LlmApiStyle => {
  if (config.provider === "claudecode") return "claude-code";
  return config.apiStyle;
};

const getAdapter = (config: LlmConfig) => ADAPTERS[resolveApiStyle(config)] ?? openAiAdapter;

const readSseText = async (response: Response, adapter: Adapter) => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let collected = "";

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(":")) return;
    const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
    if (!payload || payload === "[DONE]") return;
    try {
      const parsed = JSON.parse(payload) as unknown;
      const piece = adapter.extractStreamText(parsed);
      if (piece) collected += piece;
    } catch {
      // Ignore non-JSON SSE chunks.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      consumeLine(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf("\n");
    }
  }
  const rest = decoder.decode();
  if (rest) buffer += rest;
  if (buffer.trim()) consumeLine(buffer);
  return collected.trim();
};

const formatHttpError = (
  status: number,
  endpoint: string,
  activePayload: Record<string, unknown>,
  adapter: Adapter,
  data: unknown,
  rawText: string,
) => {
  const details = [adapter.getErrorMessage(data), rawText]
    .map((item) => item.trim())
    .filter(Boolean);
  const payloadSnippet = toDebugSnippet(activePayload);
  if (details.length > 0) {
    return `接口请求失败（HTTP ${status}）\nEndpoint: ${endpoint}\nRequest: ${payloadSnippet || "(空)"}\n\n${details.join("\n\n")}`;
  }
  return `接口请求失败（HTTP ${status}）\nEndpoint: ${endpoint}\nRequest: ${payloadSnippet || "(空)"}`;
};

export const getLlmEndpointSuffix = (config: LlmConfig) => {
  const resolvedStyle = resolveApiStyle(config);
  const adapter = ADAPTERS[resolvedStyle] ?? openAiAdapter;
  if (resolvedStyle === "custom") {
    return "";
  }
  if (adapter.style === "openai-compatible" && config.provider === "openai" && config.openaiApiMode === "responses") {
    return "/responses";
  }
  return `/${adapter.endpointSuffix}`;
};

export async function requestLlmReply(config: LlmConfig, history: ChatMessage[]): Promise<string> {
  const adapter = getAdapter(config);
  const endpoint = toEndpoint(config.baseUrl.trim(), getLlmEndpointSuffix(config));
  const contextMessageLimit = Math.max(1, Math.floor(config.contextTurns || 20)) * 2;
  const recentHistory = history.slice(-contextMessageLimit).map<OpenAiMessage>((item) => ({
    role: item.role,
    content: item.content,
  }));
  const latestUser = [...history].reverse().find((item) => item.role === "user");
  const latestUserText = latestUser?.content ?? history[history.length - 1]?.content ?? "";
  const stop = buildStop(config.stop);
  const attemptPayloads = adapter.buildAttemptPayloads({
    config,
    recentHistory,
    latestUserText,
    streamEnabled: Boolean(config.stream),
    stop,
  });

  try {
    const sendOnce = async (bodyPayload: Record<string, unknown>) => {
      const requestStream = bodyPayload.stream === true;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          ...adapter.buildHeaders(config),
        },
        body: JSON.stringify(bodyPayload),
      });
      const jsonClone = response.clone();
      const rawClone = response.clone();
      const streamText = requestStream && response.ok ? await readSseText(response, adapter) : "";
      const data = (await jsonClone.json().catch(() => ({}))) as unknown;
      const rawText = takeRawError(await rawClone.text().catch(() => ""));
      return { response, data, rawText, streamText };
    };

    let activePayload: Record<string, unknown> = attemptPayloads[0] ?? {};
    let response: Response | null = null;
    let data: unknown = {};
    let rawText = "";
    let streamText = "";

    for (const attempt of attemptPayloads) {
      activePayload = attempt;
      const result = await sendOnce(attempt);
      response = result.response;
      data = result.data;
      rawText = result.rawText;
      streamText = result.streamText;
      if (response.ok) break;
    }

    if (!response) {
      throw new Error("请求失败，请检查网络或配置。");
    }
    if (!response.ok) {
      throw new Error(formatHttpError(response.status, endpoint, activePayload, adapter, data, rawText));
    }
    if (streamText) return streamText;

    const parsedText = adapter.extractNonStreamText(data);
    if (parsedText) return parsedText;

    throw new Error(
      `模型返回内容无法解析。\n请检查接口是否兼容当前模式（${adapter.modeLabel}）。\n\n响应片段：\n${toDebugSnippet(data) || "(空响应)"}`,
    );
  } catch (error) {
    throw new Error(normalizeError(error));
  }
}
