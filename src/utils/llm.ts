import type { ChatMessage, LlmConfig } from "../types/app";

type OpenAiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ResponsesInputItem = {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: "input_text"; text: string }>;
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

type ChatCompletionResponse = {
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

const toEndpoint = (baseUrl: string, config: LlmConfig) => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (config.provider === "openai") {
    return `${trimmed}/${config.openaiApiMode === "responses" ? "responses" : "chat/completions"}`;
  }
  return `${trimmed}/chat/completions`;
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
    return `${json.slice(0, 1800)}...(响应过长，已截断)`;
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

const extractResponsesOutputText = (data: ChatCompletionResponse) => {
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
  const candidateValues: unknown[] = [
    record.reasoning_content,
    record.refusal,
    extractToolCallsText(record.tool_calls),
  ];
  const merged = candidateValues
    .map((item) => extractText(item))
    .filter(Boolean)
    .join("\n")
    .trim();
  return merged;
};

const extractReplyTextFromData = (data: ChatCompletionResponse, preferDelta = false) => {
  const firstChoice = data.choices?.[0];
  if (preferDelta) {
    // In streaming mode, keep delta chunks as-is to preserve spaces/newlines.
    if (typeof firstChoice?.delta?.content === "string") {
      return firstChoice.delta.content;
    }
    if (typeof data.delta === "string") {
      return data.delta;
    }
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

const readStreamText = async (response: Response, preferResponses = false) => {
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
      const parsed = JSON.parse(payload) as ChatCompletionResponse;
      if (preferResponses && parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
        collected += parsed.delta;
        return;
      }
      const piece = extractReplyTextFromData(parsed, true);
      if (piece) collected += piece;
    } catch {
      // Ignore non-JSON chunks to avoid polluting final visible text.
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

const toResponsesInputMessages = (
  source: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>,
  structured = false,
): ResponsesInputItem[] =>
  source.map((item) => ({
    role: item.role,
    content: structured ? [{ type: "input_text", text: item.content }] : item.content,
  }));

export async function requestLlmReply(config: LlmConfig, history: ChatMessage[]): Promise<string> {
  const endpoint = toEndpoint(config.baseUrl.trim(), config);
  const responsesMode = config.provider === "openai" && config.openaiApiMode === "responses";
  const streamEnabled = Boolean(config.stream);
  const contextMessageLimit = Math.max(1, Math.floor(config.contextTurns || 20)) * 2;
  const recentHistory = history.slice(-contextMessageLimit).map<OpenAiMessage>((item) => ({
    role: item.role,
    content: item.content,
  }));
  const latestUser = [...history].reverse().find((item) => item.role === "user");
  const messages: OpenAiMessage[] = config.systemPrompt.trim()
    ? [{ role: "system", content: config.systemPrompt.trim() }, ...recentHistory]
    : recentHistory;

  try {
    const stop = buildStop(config.stop);
    const latestUserText = latestUser?.content ?? history[history.length - 1]?.content ?? "";
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
          ...(config.systemPrompt.trim() ? { instructions: config.systemPrompt.trim() } : {}),
          ...(streamEnabled ? { stream: true } : {}),
        }
      : {
          model: config.model.trim(),
          messages,
          ...(streamEnabled ? { stream: true } : {}),
        };
    const payload = config.minimalCompatibleMode
      ? {
          ...compatibleFallbackPayload,
        }
      : responsesMode
        ? {
            model: config.model.trim(),
            input: toResponsesInputMessages(recentHistory),
            ...(config.systemPrompt.trim() ? { instructions: config.systemPrompt.trim() } : {}),
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
          ...(config.maxCompletionTokens > 0 ? { max_completion_tokens: config.maxCompletionTokens } : { max_tokens: config.maxTokens }),
          stream: streamEnabled,
        };

    const sendOnce = async (bodyPayload: Record<string, unknown>) => {
      const requestStream = bodyPayload.stream === true;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
        },
        body: JSON.stringify(bodyPayload),
      });
      const jsonClone = response.clone();
      const rawClone = response.clone();
      const streamText = requestStream && response.ok ? await readStreamText(response, responsesMode) : "";
      const data = (await jsonClone.json().catch(() => ({}))) as ChatCompletionResponse;
      const rawText = takeRawError(await rawClone.text().catch(() => ""));
      return { response, data, rawText, streamText };
    };

    const attemptPayloads: Record<string, unknown>[] = [];
    pushUniquePayload(attemptPayloads, payload);
    if (responsesMode) {
      // Some OpenAI-compatible gateways only accept message-array input for /responses.
      pushUniquePayload(attemptPayloads, {
        model: config.model.trim(),
        input: toResponsesInputMessages([{ role: "user", content: latestUserText }]),
        ...(streamEnabled ? { stream: true } : {}),
      });
      // Some gateways require structured content blocks in /responses.
      pushUniquePayload(attemptPayloads, {
        model: config.model.trim(),
        input: toResponsesInputMessages([{ role: "user", content: latestUserText }], true),
        ...(streamEnabled ? { stream: true } : {}),
      });
    }
    if (!config.minimalCompatibleMode) {
      // Keep context in fallback payload so gateways that reject advanced params still receive conversation history.
      pushUniquePayload(attemptPayloads, compatibleFallbackPayload);
      // Last resort: strictly minimal payload (single user message).
      pushUniquePayload(attemptPayloads, strictMinimalPayload);
    } else {
      // In minimal-compatible mode, keep context stable and avoid dropping to single-message fallback.
      pushUniquePayload(attemptPayloads, compatibleFallbackPayload);
    }
    if (streamEnabled) {
      for (const item of [...attemptPayloads]) {
        if (Object.prototype.hasOwnProperty.call(item, "stream")) {
          pushUniquePayload(attemptPayloads, withoutStream(item));
        }
      }
    }

    let activePayload: Record<string, unknown> = attemptPayloads[0];
    let response: Response | null = null;
    let data: ChatCompletionResponse = {};
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
      const details = [data.error?.message, rawText]
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
      const payloadSnippet = toDebugSnippet(activePayload);
      throw new Error(
        details.length
          ? `接口请求失败（HTTP ${response.status}）\nEndpoint: ${endpoint}\nRequest: ${payloadSnippet || "(空)"}\n\n${details.join("\n\n")}`
          : `接口请求失败（HTTP ${response.status}）\nEndpoint: ${endpoint}\nRequest: ${payloadSnippet || "(空)"}`,
      );
    }
    if (streamText) return streamText;
    const firstChoice = data.choices?.[0];
    const parsedText = extractReplyTextFromData(data);
    if (parsedText) return parsedText;
    if (firstChoice?.message?.content === null) {
      throw new Error(
        `模型返回了空文本内容（message.content 为 null）。\n可能是网关未把结果映射到 content 字段。\n\n响应片段：\n${toDebugSnippet(data) || "(空响应)"}`,
      );
    }
    throw new Error(
      `模型返回内容无法解析。\n请检查接口是否兼容当前模式（${responsesMode ? "OpenAI Responses" : "OpenAI Chat Completions"}）。\n\n响应片段：\n${toDebugSnippet(data) || "(空响应)"}`,
    );
  } catch (error) {
    throw new Error(normalizeError(error));
  }
}
