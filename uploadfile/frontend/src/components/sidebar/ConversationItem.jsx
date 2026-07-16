export function ConversationItem({
  thread,
  isActive = false,
  disabled = false,
  onSelect,
}) {
  const title = thread?.title || "新对话";
  const preview = thread?.preview || "暂无消息";
  const timeLabel = thread?.timeLabel || thread?.relativeTime || "";

  return (
    <li className="ai-conversation-item-wrap">
      <button
        type="button"
        className={`ai-conversation-item${isActive ? " ai-conversation-item--active" : ""}`}
        aria-current={isActive ? "true" : undefined}
        disabled={disabled}
        onClick={() => onSelect?.(thread?.id)}
      >
        <span className="ai-conversation-item__title" title={title}>
          {title}
        </span>
        <span className="ai-conversation-item__preview" title={preview}>
          {preview}
        </span>
        {timeLabel ? (
          <time className="ai-conversation-item__time" dateTime={thread?.updatedAt}>
            {timeLabel}
          </time>
        ) : null}
      </button>
    </li>
  );
}
