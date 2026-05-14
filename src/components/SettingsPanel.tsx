import { useRef, type CSSProperties, type RefObject } from "react";
import { CircleHelp, Upload, X } from "lucide-react";
import { MEMO_BOOST } from "../constants/app";
import type { LlmConfig } from "../types/app";
import { getLlmEndpointSuffix } from "../utils/llm";

type Props = {
  open: boolean;
  position: { x: number; y: number };
  settingsPanelRef: RefObject<HTMLElement | null>;
  onHeaderMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  swallowEnabled: boolean;
  onToggleSwallow: () => void;
  styleOptions: Array<{ id: string; label: string }>;
  styleId: string;
  onStyleChange: (styleId: string) => void;
  hatchPetInstalling: boolean;
  onInstallHatchPetZip: (file: File) => void;
  llmConfig: LlmConfig;
  onUpdateLlmConfig: (patch: Partial<LlmConfig>) => void;
  onClose: () => void;
};

export default function SettingsPanel({
  open,
  position,
  settingsPanelRef,
  onHeaderMouseDown,
  swallowEnabled,
  onToggleSwallow,
  styleOptions,
  styleId,
  onStyleChange,
  hatchPetInstalling,
  onInstallHatchPetZip,
  llmConfig,
  onUpdateLlmConfig,
  onClose,
}: Props) {
  const hatchPetFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;
  const endpointSuffix = getLlmEndpointSuffix(llmConfig);
  const isClaudeCodeProvider = llmConfig.provider === "claudecode";
  const isCustomProvider = llmConfig.provider === "custom";
  const isCustomApiStyle = llmConfig.apiStyle === "custom";

  return (
    <aside
      className="settings-panel open"
      style={
        {
          left: `${position.x}px`,
          top: `${position.y}px`,
          "--memo-boost": `${MEMO_BOOST}`,
        } as CSSProperties
      }
      onClick={(event) => event.stopPropagation()}
      ref={settingsPanelRef}
    >
      <header className="settings-header" onMouseDown={onHeaderMouseDown}>
        <span className="settings-title">设置</span>
        <button type="button" className="memo-top-btn" onClick={onClose} aria-label="关闭设置面板" title="关闭设置面板">
          <X size={9} strokeWidth={2.2} />
        </button>
      </header>
      <div className="settings-list">
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-label">吞噬功能</span>
            <span className="settings-help-wrap">
              <button
                type="button"
                className="settings-help"
                aria-label="吞噬功能说明"
                title="吞噬功能说明"
                onClick={(event) => event.preventDefault()}
              >
                <CircleHelp size={11} strokeWidth={2.15} />
              </button>
              <span className="settings-help-tip">拖拽文件到主体热区，确认后移入回收站。</span>
            </span>
          </div>
          <button
            type="button"
            className={`settings-switch ${swallowEnabled ? "on" : "off"}`}
            onClick={onToggleSwallow}
            aria-pressed={swallowEnabled}
            aria-label={swallowEnabled ? "关闭吞噬功能" : "开启吞噬功能"}
            title={swallowEnabled ? "关闭吞噬功能" : "开启吞噬功能"}
          >
            <span className="settings-switch-dot" />
          </button>
        </div>
        <div className="settings-row settings-row-column">
          <label className="settings-field">
            <span className="settings-field-label">风格</span>
            <select className="settings-input" value={styleId} onChange={(event) => onStyleChange(event.target.value)}>
              {styleOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="settings-inline-actions">
            <input
              ref={hatchPetFileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="settings-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) onInstallHatchPetZip(file);
              }}
            />
            <button
              type="button"
              className="settings-action-button"
              onClick={() => hatchPetFileInputRef.current?.click()}
              disabled={hatchPetInstalling}
              aria-label="上传 zip 安装 Hatch Pet"
              title="上传 zip 安装 Hatch Pet"
            >
              <Upload size={12} strokeWidth={2.2} />
              <span>{hatchPetInstalling ? "安装中" : "上传 zip 安装"}</span>
            </button>
          </div>
        </div>
        <div className="settings-row settings-row-column">
          <div className="settings-row-main">
            <span className="settings-row-label">LLM 快捷开关</span>
            <span className="settings-help-wrap">
              <button
                type="button"
                className="settings-help"
                aria-label="LLM 开关说明"
                title="LLM 开关说明"
                onClick={(event) => event.preventDefault()}
              >
                <CircleHelp size={11} strokeWidth={2.15} />
              </button>
              <span className="settings-help-tip">最小兼容模式会隐藏并忽略细节参数；流式不兼容时可手动关闭。</span>
            </span>
          </div>
          <div className="settings-toggle-grid">
            <div className="settings-toggle-item">
              <span className="settings-field-label">启用聊天</span>
              <button
                type="button"
                className={`settings-switch ${llmConfig.enabled ? "on" : "off"}`}
                onClick={() => onUpdateLlmConfig({ enabled: !llmConfig.enabled })}
                aria-pressed={llmConfig.enabled}
                aria-label={llmConfig.enabled ? "关闭 LLM 聊天" : "开启 LLM 聊天"}
                title={llmConfig.enabled ? "关闭 LLM 聊天" : "开启 LLM 聊天"}
              >
                <span className="settings-switch-dot" />
              </button>
            </div>
            <div className="settings-toggle-item">
              <span className="settings-field-label">最小兼容</span>
              <button
                type="button"
                className={`settings-switch ${llmConfig.minimalCompatibleMode ? "on" : "off"} ${!llmConfig.enabled ? "disabled" : ""}`}
                onClick={() => onUpdateLlmConfig({ minimalCompatibleMode: !llmConfig.minimalCompatibleMode })}
                disabled={!llmConfig.enabled}
                aria-pressed={llmConfig.minimalCompatibleMode}
                aria-disabled={!llmConfig.enabled}
                aria-label={llmConfig.minimalCompatibleMode ? "关闭最小兼容模式" : "开启最小兼容模式"}
                title={llmConfig.minimalCompatibleMode ? "关闭最小兼容模式" : "开启最小兼容模式"}
              >
                <span className="settings-switch-dot" />
              </button>
            </div>
          </div>
        </div>
        {llmConfig.enabled && (
          <div className="settings-row settings-row-column">
            <label className="settings-field">
              <span className="settings-field-label">服务商</span>
              <select
                className="settings-input"
                value={llmConfig.provider}
                onChange={(event) => {
                  const nextProvider = event.target.value as LlmConfig["provider"];
                  onUpdateLlmConfig({
                    provider: nextProvider,
                    apiStyle: nextProvider === "claudecode" ? "claude-code" : "openai-compatible",
                  });
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="claudecode">ClaudeCode</option>
                <option value="custom">自定义兼容</option>
              </select>
            </label>
            {isCustomProvider && (
              <label className="settings-field">
                <span className="settings-field-label">接口形态</span>
                <select
                  className="settings-input"
                  value={llmConfig.apiStyle}
                  onChange={(event) => onUpdateLlmConfig({ apiStyle: event.target.value as LlmConfig["apiStyle"] })}
                >
                  <option value="openai-compatible">OpenAI Compatible</option>
                  <option value="claude-code">ClaudeCode 风格（预留）</option>
                  <option value="custom">自定义</option>
                </select>
              </label>
            )}
            <label className="settings-field">
              <span className="settings-field-label">Base URL</span>
              <div className="settings-base-url-group">
                <input
                  className="settings-input"
                  type="text"
                  value={llmConfig.baseUrl}
                  placeholder={
                    isCustomApiStyle
                      ? "例如：https://your-gateway.example.com/v1/chat/completions"
                      : isClaudeCodeProvider
                        ? "例如：https://www.newapi.ai/v1"
                        : "例如：https://api.openai.com/v1"
                  }
                  disabled={!isCustomApiStyle}
                  onChange={(event) => onUpdateLlmConfig({ baseUrl: event.target.value })}
                />
                {endpointSuffix ? (
                  <span className="settings-endpoint-suffix" title={endpointSuffix}>
                    {endpointSuffix}
                  </span>
                ) : null}
              </div>
            </label>
            <label className="settings-field">
              <span className="settings-field-label">模型名称</span>
              <input
                className="settings-input"
                type="text"
                value={llmConfig.model}
                placeholder="例如：gpt-4o-mini"
                onChange={(event) => onUpdateLlmConfig({ model: event.target.value })}
              />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">API Key</span>
              <input
                className="settings-input"
                type="password"
                value={llmConfig.apiKey}
                placeholder="输入你的 API Key"
                onChange={(event) => onUpdateLlmConfig({ apiKey: event.target.value })}
              />
            </label>
            <div className="settings-toggle-item">
              <span className="settings-field-label">流式响应</span>
              <button
                type="button"
                className={`settings-switch ${llmConfig.stream ? "on" : "off"}`}
                onClick={() => onUpdateLlmConfig({ stream: !llmConfig.stream })}
                aria-pressed={llmConfig.stream}
                aria-label={llmConfig.stream ? "关闭流式响应" : "开启流式响应"}
                title={llmConfig.stream ? "关闭流式响应" : "开启流式响应"}
              >
                <span className="settings-switch-dot" />
              </button>
            </div>
            <label className="settings-field">
              <span className="settings-field-label">上下文轮数（问答）</span>
              <input
                className="settings-input"
                type="number"
                min={1}
                max={50}
                step={1}
                value={llmConfig.contextTurns}
                onChange={(event) => onUpdateLlmConfig({ contextTurns: Number.parseInt(event.target.value, 10) || 1 })}
              />
            </label>
            {!llmConfig.minimalCompatibleMode && (
              <>
                <div className="settings-field-grid">
                  <label className="settings-field">
                    <span className="settings-field-label">Temperature</span>
                    <input
                      className="settings-input"
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={llmConfig.temperature}
                      onChange={(event) => onUpdateLlmConfig({ temperature: Number.parseFloat(event.target.value) || 0 })}
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">Top P</span>
                    <input
                      className="settings-input"
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={llmConfig.topP}
                      onChange={(event) => onUpdateLlmConfig({ topP: Number.parseFloat(event.target.value) || 0 })}
                    />
                  </label>
                </div>
                <div className="settings-field-grid">
                  <label className="settings-field">
                    <span className="settings-field-label">N</span>
                    <input
                      className="settings-input"
                      type="number"
                      min={1}
                      max={8}
                      step={1}
                      value={llmConfig.n}
                      onChange={(event) => onUpdateLlmConfig({ n: Number.parseInt(event.target.value, 10) || 1 })}
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">Max Tokens</span>
                    <input
                      className="settings-input"
                      type="number"
                      min={1}
                      max={8192}
                      step={1}
                      value={llmConfig.maxTokens}
                      onChange={(event) => onUpdateLlmConfig({ maxTokens: Number.parseInt(event.target.value, 10) || 1 })}
                    />
                  </label>
                </div>
                <div className="settings-field-grid">
                  <label className="settings-field">
                    <span className="settings-field-label">Presence Penalty</span>
                    <input
                      className="settings-input"
                      type="number"
                      min={-2}
                      max={2}
                      step={0.1}
                      value={llmConfig.presencePenalty}
                      onChange={(event) => onUpdateLlmConfig({ presencePenalty: Number.parseFloat(event.target.value) || 0 })}
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">Frequency Penalty</span>
                    <input
                      className="settings-input"
                      type="number"
                      min={-2}
                      max={2}
                      step={0.1}
                      value={llmConfig.frequencyPenalty}
                      onChange={(event) => onUpdateLlmConfig({ frequencyPenalty: Number.parseFloat(event.target.value) || 0 })}
                    />
                  </label>
                </div>
                <label className="settings-field">
                  <span className="settings-field-label">Max Completion Tokens (0=关闭)</span>
                  <input
                    className="settings-input"
                    type="number"
                    min={0}
                    max={8192}
                    step={1}
                    value={llmConfig.maxCompletionTokens}
                    onChange={(event) => onUpdateLlmConfig({ maxCompletionTokens: Number.parseInt(event.target.value, 10) || 0 })}
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Stop（逗号或换行分隔）</span>
                  <textarea
                    className="settings-textarea"
                    rows={2}
                    value={llmConfig.stop}
                    placeholder="例如：END,###"
                    onChange={(event) => onUpdateLlmConfig({ stop: event.target.value })}
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">User（可选）</span>
                  <input
                    className="settings-input"
                    type="text"
                    value={llmConfig.user}
                    placeholder="例如：user-001"
                    onChange={(event) => onUpdateLlmConfig({ user: event.target.value })}
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">系统提示词</span>
                  <textarea
                    className="settings-textarea"
                    rows={3}
                    value={llmConfig.systemPrompt}
                    placeholder="设定助手角色、语气和约束"
                    onChange={(event) => onUpdateLlmConfig({ systemPrompt: event.target.value })}
                  />
                </label>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
