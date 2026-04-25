import { useState, type CSSProperties, type RefObject } from "react";
import { Check, Copy, Eraser, Send, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import thinkingRimuruGif4 from "../assets/chat_thinking_rimuru_4.gif";
import { MEMO_BOOST } from "../constants/app";
import type { ChatMessage } from "../types/app";

type Props = {
  open: boolean;
  position: { x: number; y: number };
  chatPanelRef: RefObject<HTMLElement | null>;
  onHeaderMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  messages: ChatMessage[];
  input: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onClearContext: () => void;
  onClose: () => void;
};

type MarkdownCodeProps = {
  className?: string;
  inline?: boolean;
  children?: React.ReactNode;
  copyText: (text: string) => Promise<boolean>;
};

function MarkdownCode({ className, inline, children, copyText }: MarkdownCodeProps) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");

  if (inline) return <code className={className}>{children}</code>;

  return (
    <div className="chat-code-block">
      <button
        type="button"
        className="chat-code-copy-btn"
        onClick={() => {
          void copyText(code).then((ok) => {
            if (!ok) {
              window.alert("复制代码失败，请检查剪贴板权限。");
              return;
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          });
        }}
        title="复制代码"
        aria-label={copied ? "代码已复制" : "复制代码"}
      >
        {copied ? <Check size={10} strokeWidth={2.2} /> : <Copy size={10} strokeWidth={2.2} />}
      </button>
      <pre>
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

export default function ChatPanel({
  open,
  position,
  chatPanelRef,
  onHeaderMouseDown,
  messages,
  input,
  isSending,
  onInputChange,
  onSend,
  onClearContext,
  onClose,
}: Props) {
  const [historyCopying, setHistoryCopying] = useState(false);
  const [copyingMessageId, setCopyingMessageId] = useState<string | null>(null);
  if (!open) return null;

  const copyText = async (text: string) => {
    const value = text.trim();
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textArea);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const copyChatHistory = async () => {
    if (!messages.length || historyCopying) return;
    setHistoryCopying(true);
    const historyText = messages.map((message) => `[${message.role === "user" ? "你" : "利姆露"}]\n${message.content}`).join("\n\n");
    const copied = await copyText(historyText);
    if (!copied) {
      window.alert("复制聊天记录失败，请检查剪贴板权限。");
    }
    setHistoryCopying(false);
  };

  const copySingleMessage = async (message: ChatMessage) => {
    if (copyingMessageId) return;
    setCopyingMessageId(message.id);
    const copied = await copyText(message.content);
    if (!copied) {
      window.alert("复制消息失败，请检查剪贴板权限。");
    }
    window.setTimeout(() => setCopyingMessageId((prev) => (prev === message.id ? null : prev)), 900);
  };

  return (
    <aside
      className="chat-panel open"
      style={
        {
          left: `${position.x}px`,
          top: `${position.y}px`,
          "--memo-boost": `${MEMO_BOOST}`,
        } as CSSProperties
      }
      onClick={(event) => event.stopPropagation()}
      ref={chatPanelRef}
    >
      <header className="chat-header" onMouseDown={onHeaderMouseDown}>
        <span className="chat-title">聊天</span>
        <div
          className="chat-header-actions"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            className="chat-header-btn chat-header-icon-btn"
            onClick={onClearContext}
            disabled={isSending}
            aria-label="清空上下文"
            title="清空上下文"
          >
            <Eraser size={12} strokeWidth={2.1} />
          </button>
          <button
            type="button"
            className="chat-header-btn chat-header-icon-btn"
            onClick={() => {
              void copyChatHistory();
            }}
            disabled={!messages.length || historyCopying}
            aria-label="复制聊天记录"
            title="复制聊天记录"
          >
            {historyCopying ? <Check size={12} strokeWidth={2.2} /> : <Copy size={12} strokeWidth={2.1} />}
          </button>
          <button
            type="button"
            className="memo-top-btn chat-close-btn"
            onClick={onClose}
            aria-label="关闭聊天面板"
            title="关闭聊天面板"
          >
            <X size={11} strokeWidth={2.1} />
          </button>
        </div>
      </header>
      <div className="chat-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">还没有聊天记录，输入消息开始和利姆露对话吧。</div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`chat-message ${message.role === "user" ? "user" : "assistant"}`}
              title={message.content}
            >
              <div className="chat-message-top">
                <span className="chat-message-role">{message.role === "user" ? "你" : "利姆露"}</span>
                <button
                  type="button"
                  className="chat-message-copy-btn"
                  onClick={() => {
                    void copySingleMessage(message);
                  }}
                  disabled={copyingMessageId === message.id}
                  aria-label="复制本条消息"
                  title="复制本条消息"
                >
                  {copyingMessageId === message.id ? <Check size={10} strokeWidth={2.2} /> : <Copy size={10} strokeWidth={2.1} />}
                </button>
              </div>
              <span
                className="chat-message-text markdown"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
                    code: ({ className, children, ...props }) => (
                      <MarkdownCode className={className} inline={Boolean((props as { inline?: boolean }).inline)} copyText={copyText}>
                        {children}
                      </MarkdownCode>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </span>
            </article>
          ))
        )}
        {isSending && (
          <article className="chat-message assistant pending" aria-label="请求中">
            <span className="chat-message-role">利姆露</span>
            <span className="chat-message-text chat-loading" aria-live="polite">
              <img className="chat-loading-gif" src={thinkingRimuruGif4} alt="利姆露思考中" />
              <span>思考中</span>
            </span>
          </article>
        )}
      </div>
      <div className="chat-input-wrap">
        <textarea
          className="chat-input"
          value={input}
          rows={2}
          placeholder="输入消息..."
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button
          type="button"
          className={`chat-send ${isSending ? "sending" : ""}`}
          onClick={onSend}
          disabled={isSending}
          aria-label={isSending ? "发送中" : "发送消息"}
          title={isSending ? "发送中" : "发送消息"}
        >
          <Send size={12} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}
