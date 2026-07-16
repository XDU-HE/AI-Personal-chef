import { CircleCheck, LoaderCircle, RotateCcw, X } from "lucide-react";

export function ImagePreview({
  src,
  name = "待上传食材图片",
  status = "idle",
  progress,
  error = "",
  disabled = false,
  onRemove,
  onRetry,
  className = "",
}) {
  if (!src && !name) return null;

  const isUploading = status === "uploading";
  const isUploaded = status === "uploaded";
  const hasError = status === "error";
  const hasProgress = Number.isFinite(progress);

  return (
    <div
      className={`ai-image-preview ai-image-preview--${status} ${className}`.trim()}
      aria-busy={isUploading}
    >
      {src ? <img className="ai-image-preview__image" src={src} alt={name} /> : null}

      <div className="ai-image-preview__details">
        <span className="ai-image-preview__name" title={name}>
          {name}
        </span>

        {isUploading ? (
          <div className="ai-image-preview__status" role="status" aria-live="polite">
            <LoaderCircle className="ai-icon-spin" aria-hidden="true" />
            <span>{hasProgress ? `上传中 ${Math.round(progress)}%` : "正在上传图片…"}</span>
          </div>
        ) : null}

        {isUploading ? (
          <progress
            className="ai-image-preview__progress"
            max="100"
            value={hasProgress ? progress : undefined}
            aria-label="图片上传进度"
          />
        ) : null}

        {isUploaded ? (
          <div className="ai-image-preview__status ai-image-preview__status--success" role="status">
            <CircleCheck aria-hidden="true" />
            <span>图片已上传</span>
          </div>
        ) : null}

        {hasError ? (
          <div className="ai-image-preview__error" role="alert">
            <span>{error || "图片上传失败，请重试。"}</span>
            {onRetry ? (
              <button
                type="button"
                className="ai-image-preview__retry"
                disabled={disabled}
                onClick={onRetry}
              >
                <RotateCcw aria-hidden="true" />
                <span>重新上传</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="ai-image-preview__remove"
        aria-label={`移除图片：${name}`}
        title="移除图片"
        disabled={disabled}
        onClick={onRemove}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
