import { Plus, Trash2 } from "lucide-react";
import { ConversationItem } from "./ConversationItem.jsx";

export function ConversationSidebar({
  threads = [],
  activeThreadId = null,
  onNewChat,
  onSelectThread,
  onClearCurrent,
  newChatDisabled = false,
  threadSelectionDisabled = false,
  clearDisabled = false,
  emptyLabel = "还没有最近对话",
  className = "",
}) {
  return (
    <aside className={`ai-sidebar ${className}`.trim()} aria-label="会话侧边栏">
      <div className="ai-sidebar__brand">
        <div className="ai-sidebar__brand-name">AI 私厨助手</div>
        <div className="ai-sidebar__brand-kicker">PRIVATE KITCHEN</div>
      </div>

      <div className="ai-sidebar__primary-action">
        <button
          type="button"
          className="ai-sidebar__new-chat"
          disabled={newChatDisabled}
          onClick={onNewChat}
        >
          <Plus aria-hidden="true" />
          <span>新建对话</span>
        </button>
      </div>

      <nav className="ai-sidebar__history" aria-label="最近对话">
        <h2 className="ai-sidebar__section-title">最近对话 RECENT</h2>
        {threads.length ? (
          <ul className="ai-sidebar__conversation-list">
            {threads.map((thread) => (
              <ConversationItem
                key={thread.id}
                thread={thread}
                isActive={thread.id === activeThreadId}
                disabled={threadSelectionDisabled}
                onSelect={onSelectThread}
              />
            ))}
          </ul>
        ) : (
          <p className="ai-sidebar__empty">{emptyLabel}</p>
        )}
      </nav>

      <div className="ai-sidebar__footer">
        <button
          type="button"
          className="ai-sidebar__clear"
          disabled={clearDisabled || !activeThreadId}
          onClick={onClearCurrent}
        >
          <Trash2 aria-hidden="true" />
          <span>清空当前会话</span>
        </button>
      </div>
    </aside>
  );
}
