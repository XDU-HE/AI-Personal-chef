import { AlertCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer } from "./components/chat/ChatComposer.jsx";
import { ChatHeader } from "./components/chat/ChatHeader.jsx";
import { EntryView } from "./components/chat/EntryView.jsx";
import { MessageList } from "./components/chat/MessageList.jsx";
import { ConfirmDialog } from "./components/ConfirmDialog.jsx";
import { ConversationSidebar } from "./components/sidebar/ConversationSidebar.jsx";
import {
  DIETARY_PREFERENCES,
  useChatWorkspace,
} from "./hooks/useChatWorkspace.js";

function PreferencesPanel({ selected, onToggle, onClose }) {
  return (
    <section
      className="ai-preferences"
      role="dialog"
      aria-modal="false"
      aria-labelledby="dietary-preferences-title"
    >
      <div className="ai-preferences__header">
        <div>
          <h2 id="dietary-preferences-title" className="ai-preferences__title">
            饮食偏好
          </h2>
          <p className="ai-preferences__copy">
            选择后会随下一条消息一起发送给私厨助手。
          </p>
        </div>
        <button
          type="button"
          className="ai-preferences__close"
          aria-label="关闭饮食偏好"
          title="关闭"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="ai-preferences__options" aria-label="可选饮食偏好">
        {DIETARY_PREFERENCES.map((preference) => (
          <button
            key={preference}
            type="button"
            className="ai-preferences__option"
            aria-pressed={selected.includes(preference)}
            onClick={() => onToggle(preference)}
          >
            {preference}
          </button>
        ))}
      </div>
    </section>
  );
}

export function App() {
  const chat = useChatWorkspace();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messageListRef = useRef(null);
  const messageBottomRef = useRef(null);
  const textareaRef = useRef(null);
  const nearBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
    nearBottomRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  useEffect(() => {
    if (!chat.messages.length || !nearBottomRef.current) return undefined;
    const frame = globalThis.requestAnimationFrame(() => scrollToBottom("auto"));
    return () => globalThis.cancelAnimationFrame(frame);
  }, [chat.messages, scrollToBottom]);

  useEffect(() => {
    nearBottomRef.current = true;
    setShowScrollToBottom(false);
  }, [chat.activeThreadId]);

  useEffect(() => {
    if (!preferencesOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setPreferencesOpen(false);
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [preferencesOpen]);

  const handleMessageScroll = useCallback((event) => {
    const element = event.currentTarget;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const isNearBottom = distance < 120;
    nearBottomRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom);
  }, []);

  const handlePromptSelect = useCallback(
    (prompt) => {
      chat.selectStarterPrompt(prompt);
      globalThis.requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [chat],
  );

  const handleNewThread = useCallback(() => {
    setPreferencesOpen(false);
    setClearDialogOpen(false);
    chat.newThread();
  }, [chat]);

  const handleSwitchThread = useCallback(
    (threadId) => {
      setPreferencesOpen(false);
      setClearDialogOpen(false);
      chat.switchThread(threadId);
    },
    [chat],
  );

  const handleConfirmClear = useCallback(async () => {
    const cleared = await chat.clearActiveThread();
    if (cleared) setClearDialogOpen(false);
  }, [chat]);

  const showMessageSurface =
    chat.isLoadingHistory || Boolean(chat.historyError) || chat.messages.length > 0;

  return (
    <div className="ai-app">
      <ConversationSidebar
        threads={chat.threads}
        activeThreadId={chat.activeThreadId}
        onNewChat={handleNewThread}
        onSelectThread={handleSwitchThread}
        onClearCurrent={() => setClearDialogOpen(true)}
        newChatDisabled={chat.isClearing}
        clearDisabled={chat.isClearing || chat.isLoadingHistory}
      />

      <main className="ai-workspace">
        <ChatHeader
          title={chat.activeThread?.title || "新对话"}
          status={chat.status.name}
          statusLabel={chat.status.label}
        />

        <div className="ai-workspace__body">
          {showMessageSurface ? (
            <MessageList
              ref={messageListRef}
              bottomRef={messageBottomRef}
              messages={chat.messages}
              isLoading={chat.isLoadingHistory}
              error={chat.historyError}
              showScrollToBottom={showScrollToBottom && chat.messages.length > 0}
              onScroll={handleMessageScroll}
              onRetryHistory={chat.retryHistory}
              onRetryMessage={chat.retryMessage}
              onScrollToBottom={() => scrollToBottom("smooth")}
            />
          ) : (
            <EntryView onPromptSelect={handlePromptSelect} />
          )}

          {chat.operationError ? (
            <div className="ai-global-error" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{chat.operationError}</span>
            </div>
          ) : null}
        </div>

        <div className="ai-composer-dock">
          {preferencesOpen ? (
            <PreferencesPanel
              selected={chat.preferences}
              onToggle={chat.togglePreference}
              onClose={() => setPreferencesOpen(false)}
            />
          ) : null}

          <ChatComposer
            textareaRef={textareaRef}
            value={chat.input}
            image={chat.image}
            disabled={chat.isClearing || chat.isLoadingHistory}
            isUploading={chat.isUploading}
            isStreaming={chat.isStreaming}
            sendDisabled={!chat.canSend}
            preferencesOpen={preferencesOpen}
            onChange={chat.changeInput}
            onSend={chat.sendMessage}
            onImageSelect={chat.selectImage}
            onRemoveImage={chat.removeImage}
            onRetryImage={chat.retryImageUpload}
            onOpenPreferences={() => setPreferencesOpen((value) => !value)}
          />
        </div>
      </main>

      <ConfirmDialog
        open={clearDialogOpen}
        title="清空当前会话？"
        description="此操作只会清空当前会话的消息，其他会话不会受到影响。清空后无法恢复。"
        isConfirming={chat.isClearing}
        onConfirm={handleConfirmClear}
        onCancel={() => setClearDialogOpen(false)}
      />
    </div>
  );
}
