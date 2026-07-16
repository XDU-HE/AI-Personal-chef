import { AlertCircle, ArrowDown, LoaderCircle, RotateCcw } from "lucide-react";
import { forwardRef } from "react";
import { MessageItem } from "./MessageItem.jsx";

function readableError(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || "历史消息加载失败。";
}

export const MessageList = forwardRef(function MessageList(
  {
    messages = [],
    isLoading = false,
    error = null,
    emptyLabel = "当前会话暂无消息",
    showScrollToBottom = false,
    bottomRef,
    onScroll,
    onRetryHistory,
    onRetryMessage,
    onImageOpen,
    onScrollToBottom,
    className = "",
  },
  ref,
) {
  const errorMessage = readableError(error);

  return (
    <section className={`ai-message-list-shell ${className}`.trim()} aria-label="对话消息">
      <div
        ref={ref}
        className="ai-message-list"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={isLoading}
        onScroll={onScroll}
      >
        <div className="ai-message-list__inner">
          {isLoading ? (
            <div className="ai-message-list__loading" role="status">
              <LoaderCircle className="ai-icon-spin" aria-hidden="true" />
              <span>正在加载历史消息…</span>
              <div className="ai-message-list__skeletons" aria-hidden="true">
                <span className="ai-message-list__skeleton" />
                <span className="ai-message-list__skeleton" />
                <span className="ai-message-list__skeleton" />
              </div>
            </div>
          ) : null}

          {!isLoading && errorMessage ? (
            <div className="ai-message-list__error" role="alert">
              <AlertCircle aria-hidden="true" />
              <p>{errorMessage}</p>
              {onRetryHistory ? (
                <button type="button" onClick={onRetryHistory}>
                  <RotateCcw aria-hidden="true" />
                  <span>重新加载</span>
                </button>
              ) : null}
            </div>
          ) : null}

          {!isLoading && !errorMessage && messages.length === 0 ? (
            <p className="ai-message-list__empty">{emptyLabel}</p>
          ) : null}

          {!isLoading && !errorMessage
            ? messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  onRetry={onRetryMessage}
                  onImageOpen={onImageOpen}
                />
              ))
            : null}

          <div ref={bottomRef} className="ai-message-list__bottom" aria-hidden="true" />
        </div>
      </div>

      {showScrollToBottom ? (
        <button
          type="button"
          className="ai-message-list__scroll-bottom"
          aria-label="回到底部"
          title="回到底部"
          onClick={onScrollToBottom}
        >
          <ArrowDown aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
});
