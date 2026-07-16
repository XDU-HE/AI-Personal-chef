import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useId } from "react";

export function ConfirmDialog({
  open = false,
  title = "清空当前会话？",
  description = "此操作只会清空当前会话的消息，且无法撤销。",
  confirmLabel = "确认清空",
  cancelLabel = "取消",
  isConfirming = false,
  destructive = true,
  onConfirm,
  onCancel,
  className = "",
}) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) return null;

  const handleBackdrop = (event) => {
    if (event.target === event.currentTarget && !isConfirming) onCancel?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !isConfirming) {
      event.preventDefault();
      onCancel?.();
    }
  };

  return (
    <div className={`ai-dialog-backdrop ${className}`.trim()} onMouseDown={handleBackdrop}>
      <section
        className="ai-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isConfirming}
        tabIndex="-1"
        onKeyDown={handleKeyDown}
      >
        <div className="ai-dialog__icon" aria-hidden="true">
          <TriangleAlert />
        </div>
        <div className="ai-dialog__content">
          <h2 id={titleId} className="ai-dialog__title">{title}</h2>
          <p id={descriptionId} className="ai-dialog__description">{description}</p>
        </div>
        <div className="ai-dialog__actions">
          <button
            type="button"
            className="ai-dialog__cancel"
            disabled={isConfirming}
            autoFocus
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`ai-dialog__confirm${destructive ? " ai-dialog__confirm--destructive" : ""}`}
            disabled={isConfirming}
            onClick={onConfirm}
          >
            {isConfirming ? <LoaderCircle className="ai-icon-spin" aria-hidden="true" /> : null}
            <span>{isConfirming ? "正在清空…" : confirmLabel}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
