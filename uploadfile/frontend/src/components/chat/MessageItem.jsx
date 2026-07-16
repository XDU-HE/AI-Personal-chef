import { AlertCircle, ChefHat, LoaderCircle, RotateCcw, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents = {
  h1: ({ node: _node, ...props }) => <h1 className="ai-markdown__h1" {...props} />,
  h2: ({ node: _node, ...props }) => <h2 className="ai-markdown__h2" {...props} />,
  h3: ({ node: _node, ...props }) => <h3 className="ai-markdown__h3" {...props} />,
  p: ({ node: _node, ...props }) => <p className="ai-markdown__paragraph" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="ai-markdown__list" {...props} />,
  ol: ({ node: _node, ...props }) => (
    <ol className="ai-markdown__list ai-markdown__list--ordered" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="ai-markdown__list-item" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="ai-markdown__quote" {...props} />
  ),
  pre: ({ node: _node, ...props }) => <pre className="ai-markdown__pre" {...props} />,
  code: ({ node: _node, ...props }) => <code className="ai-markdown__code" {...props} />,
  a: ({ node: _node, children, ...props }) => (
    <a className="ai-markdown__link" target="_blank" rel="noreferrer noopener" {...props}>
      {children}
    </a>
  ),
  table: ({ node: _node, children, ...props }) => (
    <div className="ai-markdown__table-wrap">
      <table className="ai-markdown__table" {...props}>{children}</table>
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead className="ai-markdown__thead" {...props} />,
  tbody: ({ node: _node, ...props }) => <tbody className="ai-markdown__tbody" {...props} />,
  tr: ({ node: _node, ...props }) => <tr className="ai-markdown__row" {...props} />,
  th: ({ node: _node, ...props }) => (
    <th className="ai-markdown__cell ai-markdown__cell--heading" {...props} />
  ),
  td: ({ node: _node, ...props }) => <td className="ai-markdown__cell" {...props} />,
  img: ({ node: _node, ...props }) => (
    <img className="ai-markdown__image" loading="lazy" {...props} />
  ),
};

export function MessageItem({ message, onRetry, onImageOpen }) {
  const isUser = message?.role === "user";
  const status = message?.status || "complete";
  const imageAlt = message?.imageAlt || "用户上传的食材图片";
  const messageLabel = isUser ? "用户消息" : "AI 私厨助手消息";

  const image = message?.imageUrl ? (
    <img className="ai-message__image" src={message.imageUrl} alt={imageAlt} />
  ) : null;

  return (
    <article
      className={`ai-message ai-message--${isUser ? "user" : "assistant"} ai-message--${status}`}
      aria-label={messageLabel}
    >
      <div className="ai-message__avatar" aria-hidden="true">
        {isUser ? <User /> : <ChefHat />}
      </div>

      <div className="ai-message__body">
        {image ? (
          onImageOpen ? (
            <button
              type="button"
              className="ai-message__image-button"
              aria-label="查看上传的食材图片"
              onClick={() => onImageOpen(message.imageUrl, message)}
            >
              {image}
            </button>
          ) : image
        ) : null}

        {isUser ? (
          <p className="ai-message__text">{String(message?.content || "")}</p>
        ) : (
          <div className="ai-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
              skipHtml
            >
              {String(message?.content || "")}
            </ReactMarkdown>
          </div>
        )}

        {status === "sending" ? (
          <div className="ai-message__status" role="status">
            <LoaderCircle className="ai-icon-spin" aria-hidden="true" />
            <span>发送中…</span>
          </div>
        ) : null}

        {status === "streaming" ? (
          <div className="ai-message__status ai-message__status--streaming" role="status">
            <LoaderCircle className="ai-icon-pulse" aria-hidden="true" />
            <span>正在整理菜谱…</span>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="ai-message__error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{message?.error || "消息发送失败，请重试。"}</span>
            {onRetry ? (
              <button
                type="button"
                className="ai-message__retry"
                disabled={message?.retryDisabled}
                onClick={() => onRetry(message)}
              >
                <RotateCcw aria-hidden="true" />
                <span>重试</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {message?.timestampLabel ? (
          <time className="ai-message__time" dateTime={message.timestamp}>
            {message.timestampLabel}
          </time>
        ) : null}
      </div>
    </article>
  );
}
