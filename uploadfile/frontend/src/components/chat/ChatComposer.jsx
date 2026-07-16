import { ArrowUpFromLine, Send, Settings2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";
import { ImagePreview } from "./ImagePreview.jsx";

export function ChatComposer({
  value = "",
  image = null,
  placeholder = "上传食材照片或输入烹饪想法...",
  accept = "image/jpeg,image/png,image/gif,image/webp",
  disabled = false,
  isUploading = false,
  isStreaming = false,
  sendDisabled,
  onChange,
  onSend,
  onImageSelect,
  onRemoveImage,
  onRetryImage,
  onOpenPreferences,
  textareaRef,
  preferencesOpen = false,
  className = "",
}) {
  const fileInputRef = useRef(null);
  const internalTextareaRef = useRef(null);
  const hintId = useId();
  const busy = disabled || isUploading || isStreaming;
  const hasImage = Boolean(image?.src);
  const inferredSendDisabled = busy || (!value.trim() && !hasImage) || image?.status === "error";
  const isSendDisabled = sendDisabled ?? inferredSendDisabled;

  const submit = (event) => {
    event.preventDefault();
    if (!isSendDisabled) onSend?.();
  };

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !isSendDisabled
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) onImageSelect?.(file);
    event.target.value = "";
  };

  const setTextareaNode = useCallback(
    (node) => {
      internalTextareaRef.current = node;
      if (typeof textareaRef === "function") textareaRef(node);
      else if (textareaRef) textareaRef.current = node;
    },
    [textareaRef],
  );

  useEffect(() => {
    const textarea = internalTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <form className={`ai-composer-wrap ${className}`.trim()} onSubmit={submit}>
      <div className="ai-composer">
        {image ? (
          <ImagePreview
            src={image.src}
            name={image.name}
            status={image.status}
            progress={image.progress}
            error={image.error}
            disabled={busy}
            onRemove={onRemoveImage}
            onRetry={onRetryImage}
          />
        ) : null}

        <div className="ai-composer__field">
          <textarea
            ref={setTextareaNode}
            className="ai-composer__textarea"
            rows="1"
            value={value}
            placeholder={placeholder}
            aria-label="输入烹饪需求"
            aria-describedby={hintId}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="ai-composer__actions">
          <div className="ai-composer__actions-start">
            <button
              type="button"
              className="ai-composer__upload"
              aria-label="上传图片"
              title="上传图片"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <ArrowUpFromLine aria-hidden="true" />
            </button>
            <input
              ref={fileInputRef}
              className="ai-visually-hidden"
              type="file"
              accept={accept}
              disabled={busy}
              tabIndex="-1"
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="ai-composer__preferences"
              disabled={busy}
              aria-haspopup="dialog"
              aria-expanded={preferencesOpen}
              onClick={onOpenPreferences}
            >
              <Settings2 aria-hidden="true" />
              <span>饮食偏好</span>
            </button>
          </div>

          <button
            type="submit"
            className="ai-composer__send"
            aria-label="发送消息"
            title="发送消息"
            disabled={isSendDisabled}
          >
            <Send aria-hidden="true" />
          </button>
        </div>
      </div>

      <p id={hintId} className="ai-composer__hint">
        Enter 发送 · Shift + Enter 换行
      </p>
    </form>
  );
}
