const KNOWN_STATUSES = new Set([
  "ready",
  "loading",
  "uploading",
  "streaming",
  "clearing",
  "error",
]);

export function ChatHeader({
  title = "新对话",
  status = "ready",
  statusLabel = "就绪 Ready",
  className = "",
}) {
  const statusName = KNOWN_STATUSES.has(status) ? status : "ready";

  return (
    <header className={`ai-chat-header ${className}`.trim()}>
      <div className="ai-chat-header__identity">
        <h1 className="ai-chat-header__title" title={title}>
          {title}
        </h1>
        <span
          className={`ai-chat-header__status ai-chat-header__status--${statusName}`}
          role="status"
          aria-live="polite"
        >
          {statusLabel}
        </span>
      </div>
    </header>
  );
}
