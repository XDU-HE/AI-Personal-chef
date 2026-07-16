import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearChatMessages,
  fetchChatMessages,
  streamChat,
} from "../api/chat.js";
import { isAbortError } from "../api/client.js";
import { createUuid } from "../utils/uuid.js";
import {
  createThreadTitle,
  DEFAULT_THREAD_TITLE,
} from "../utils/thread.js";
import { useConversationStore } from "./useConversationStore.js";
import { useImageUpload } from "./useImageUpload.js";

export const IMAGE_ONLY_MESSAGE = "请识别图片中的食材并推荐菜谱";

export const DIETARY_PREFERENCES = Object.freeze([
  "少油",
  "高蛋白",
  "素食",
  "不吃辣",
  "无乳制品",
  "无麸质",
]);

function readableError(error, fallback = "操作失败，请稍后重试。") {
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function createMessageId(role) {
  return `${role}-${createUuid()}`;
}

function historyToMessages(history, threadId) {
  return history
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message, index) => ({
      id: `history-${threadId}-${index}`,
      role: message.role,
      content: typeof message.content === "string" ? message.content : String(message.content ?? ""),
      status: "complete",
    }));
}

function formatThreadTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const difference = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(timestamp));
}

function createPreview(value, maxLength = 36) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function withPreferences(message, preferences) {
  if (!preferences.length) return message;
  return `${message}\n\n饮食偏好：${preferences.join("、")}`;
}

function updateAssistantMessage(messages, assistantId, update) {
  return messages.map((message) => {
    if (message.id !== assistantId) return message;
    return {
      ...message,
      ...(typeof update === "function" ? update(message) : update),
    };
  });
}

export function useChatWorkspace() {
  const conversationStore = useConversationStore();
  const imageUpload = useImageUpload();
  const {
    threads,
    activeThreadId,
    activeThread,
    createThread,
    selectThread,
    updateThread,
    resetThread,
  } = conversationStore;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [preferences, setPreferences] = useState([]);
  const [cachedImageUrl, setCachedImageUrl] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [operationError, setOperationError] = useState(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  const activeThreadIdRef = useRef(activeThreadId);
  const inputRef = useRef(input);
  const requestControllerRef = useRef(null);
  const historyControllerRef = useRef(null);
  const streamRequestIdRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const threadActionLockRef = useRef(false);
  const lastFailedSubmissionRef = useRef(null);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const abortCurrentRequest = useCallback(() => {
    streamRequestIdRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    isSubmittingRef.current = false;
    setIsStreaming(false);
  }, []);

  useEffect(
    () => () => {
      abortCurrentRequest();
      historyControllerRef.current?.abort();
    },
    [abortCurrentRequest],
  );

  useEffect(() => {
    const threadId = activeThreadId;
    if (!threadId) {
      setMessages([]);
      setIsLoadingHistory(false);
      return undefined;
    }

    activeThreadIdRef.current = threadId;
    historyControllerRef.current?.abort();
    const controller = new AbortController();
    historyControllerRef.current = controller;

    setMessages([]);
    setHistoryError(null);
    setOperationError(null);
    setIsLoadingHistory(true);

    fetchChatMessages(threadId, { signal: controller.signal })
      .then((history) => {
        if (controller.signal.aborted || activeThreadIdRef.current !== threadId) return;
        setMessages(historyToMessages(history, threadId));
      })
      .catch((error) => {
        if (isAbortError(error) || activeThreadIdRef.current !== threadId) return;
        setHistoryError(readableError(error, "加载会话记录失败，请稍后重试。"));
      })
      .finally(() => {
        if (!controller.signal.aborted && activeThreadIdRef.current === threadId) {
          setIsLoadingHistory(false);
        }
        if (historyControllerRef.current === controller) {
          historyControllerRef.current = null;
        }
      });

    return () => controller.abort();
  }, [activeThreadId, historyReloadKey]);

  const runStream = useCallback(
    async (submission, providedController = null) => {
      const controller = providedController ?? new AbortController();
      requestControllerRef.current = controller;
      const requestId = streamRequestIdRef.current + 1;
      streamRequestIdRef.current = requestId;
      let accumulated = "";

      setIsStreaming(true);
      setOperationError(null);
      setMessages((currentMessages) =>
        updateAssistantMessage(currentMessages, submission.assistantId, {
          content: "",
          status: "streaming",
          error: null,
          retryDisabled: true,
        }),
      );

      try {
        const completeText = await streamChat({
          message: submission.backendMessage,
          imageUrl: submission.imageUrl,
          threadId: submission.threadId,
          signal: controller.signal,
          onChunk: (chunk) => {
            if (
              controller.signal.aborted ||
              streamRequestIdRef.current !== requestId ||
              activeThreadIdRef.current !== submission.threadId
            ) {
              return;
            }
            accumulated += chunk;
            setMessages((currentMessages) =>
              updateAssistantMessage(currentMessages, submission.assistantId, {
                content: accumulated,
                status: "streaming",
              }),
            );
          },
        });

        if (
          controller.signal.aborted ||
          streamRequestIdRef.current !== requestId ||
          activeThreadIdRef.current !== submission.threadId
        ) {
          return false;
        }

        if (!completeText.trim()) {
          throw new Error("没有收到有效回复，请重试。");
        }

        setMessages((currentMessages) =>
          updateAssistantMessage(currentMessages, submission.assistantId, {
            content: completeText,
            status: "complete",
            error: null,
            retryDisabled: false,
          }),
        );
        lastFailedSubmissionRef.current = null;
        setOperationError(null);
        setInput((currentInput) =>
          currentInput === submission.originalInput ? "" : currentInput,
        );
        setCachedImageUrl(null);
        imageUpload.removeImage();
        return true;
      } catch (error) {
        if (
          isAbortError(error) ||
          controller.signal.aborted ||
          streamRequestIdRef.current !== requestId ||
          activeThreadIdRef.current !== submission.threadId
        ) {
          return false;
        }

        const message = readableError(error, "回复中断，请重试。");
        lastFailedSubmissionRef.current = submission;
        setMessages((currentMessages) =>
          updateAssistantMessage(currentMessages, submission.assistantId, {
            content: accumulated,
            status: "error",
            error: message,
            retryDisabled: false,
          }),
        );
        setOperationError("回复未完成，已保留您的文字和图片，可直接重试。");
        return false;
      } finally {
        if (streamRequestIdRef.current === requestId) {
          setIsStreaming(false);
          isSubmittingRef.current = false;
        }
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
      }
    },
    [imageUpload],
  );

  const sendMessage = useCallback(async () => {
    if (
      isSubmittingRef.current ||
      isLoadingHistory ||
      isStreaming ||
      isClearing
    ) {
      return false;
    }

    const originalInput = input;
    const trimmedInput = originalInput.trim();
    const selectedImage = imageUpload.selectedImage;
    if (!trimmedInput && !selectedImage) return false;

    const threadId = activeThreadIdRef.current;
    if (!threadId) return false;

    isSubmittingRef.current = true;
    setOperationError(null);
    imageUpload.resetUploadError();

    const controller = new AbortController();
    requestControllerRef.current = controller;
    let imageUrl = cachedImageUrl;

    try {
      if (selectedImage && !imageUrl) {
        imageUrl = await imageUpload.uploadSelectedImage({ signal: controller.signal });
        if (controller.signal.aborted || activeThreadIdRef.current !== threadId) {
          return false;
        }
        setCachedImageUrl(imageUrl);
      }

      const visibleMessage = trimmedInput || IMAGE_ONLY_MESSAGE;
      const backendMessage = withPreferences(visibleMessage, preferences);
      const timestamp = new Date().toISOString();
      const userMessageId = createMessageId("user");
      const assistantId = createMessageId("assistant");
      const userMessage = {
        id: userMessageId,
        role: "user",
        content: backendMessage,
        imageUrl: imageUrl || undefined,
        status: "complete",
        timestamp,
        timestampLabel: "刚刚",
      };
      const assistantMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "streaming",
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        userMessage,
        assistantMessage,
      ]);
      updateThread(threadId, (thread) => ({
        title:
          thread.title === DEFAULT_THREAD_TITLE
            ? createThreadTitle(visibleMessage)
            : thread.title,
        preview: createPreview(visibleMessage),
        updatedAt: timestamp,
      }));

      const submission = {
        threadId,
        userMessageId,
        assistantId,
        backendMessage,
        imageUrl: imageUrl || null,
        originalInput,
      };
      lastFailedSubmissionRef.current = null;
      return await runStream(submission, controller);
    } catch (error) {
      if (!isAbortError(error) && !controller.signal.aborted) {
        setOperationError(readableError(error, "图片上传失败，请稍后重试。"));
      }
      isSubmittingRef.current = false;
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      return false;
    }
  }, [
    cachedImageUrl,
    imageUpload,
    input,
    isClearing,
    isLoadingHistory,
    isStreaming,
    preferences,
    runStream,
    updateThread,
  ]);

  const retryMessage = useCallback(
    async (message) => {
      const submission = lastFailedSubmissionRef.current;
      if (
        !submission ||
        submission.assistantId !== message?.id ||
        submission.threadId !== activeThreadIdRef.current ||
        isSubmittingRef.current
      ) {
        return false;
      }

      isSubmittingRef.current = true;
      return runStream(submission);
    },
    [runStream],
  );

  const retryImageUpload = useCallback(async () => {
    if (!imageUpload.selectedImage) return null;
    setOperationError(null);
    imageUpload.resetUploadError();
    try {
      const accessUrl = await imageUpload.uploadSelectedImage();
      setCachedImageUrl(accessUrl);
      return accessUrl;
    } catch (error) {
      if (!isAbortError(error)) {
        setOperationError(readableError(error, "图片上传失败，请稍后重试。"));
      }
      return null;
    }
  }, [imageUpload]);

  const selectImage = useCallback(
    (file) => {
      setCachedImageUrl(null);
      setOperationError(null);
      const result = imageUpload.selectImage(file);
      if (!result.ok) setOperationError(result.error);
      return result;
    },
    [imageUpload],
  );

  const removeImage = useCallback(() => {
    setCachedImageUrl(null);
    setOperationError(null);
    imageUpload.removeImage();
  }, [imageUpload]);

  const changeInput = useCallback((value) => {
    setInput(value);
    setOperationError(null);
  }, []);

  const selectStarterPrompt = useCallback((prompt) => {
    setInput(prompt?.value || prompt?.title || "");
    setOperationError(null);
  }, []);

  const togglePreference = useCallback((preference) => {
    setPreferences((currentPreferences) =>
      currentPreferences.includes(preference)
        ? currentPreferences.filter((item) => item !== preference)
        : [...currentPreferences, preference],
    );
  }, []);

  const resetConversationSurface = useCallback(() => {
    setMessages([]);
    setInput("");
    setCachedImageUrl(null);
    setHistoryError(null);
    setOperationError(null);
    lastFailedSubmissionRef.current = null;
    imageUpload.removeImage();
  }, [imageUpload]);

  const switchThread = useCallback(
    (threadId) => {
      if (!threadId || threadId === activeThreadIdRef.current) return;
      abortCurrentRequest();
      historyControllerRef.current?.abort();
      activeThreadIdRef.current = threadId;
      resetConversationSurface();
      selectThread(threadId);
    },
    [abortCurrentRequest, resetConversationSurface, selectThread],
  );

  const newThread = useCallback(() => {
    if (threadActionLockRef.current || isClearing) return null;
    threadActionLockRef.current = true;
    abortCurrentRequest();
    historyControllerRef.current?.abort();
    resetConversationSurface();
    const thread = createThread();
    activeThreadIdRef.current = thread.id;
    globalThis.setTimeout(() => {
      threadActionLockRef.current = false;
    }, 180);
    return thread;
  }, [abortCurrentRequest, createThread, isClearing, resetConversationSurface]);

  const clearActiveThread = useCallback(async () => {
    const threadId = activeThreadIdRef.current;
    if (!threadId || isClearing) return false;

    abortCurrentRequest();
    setIsClearing(true);
    setOperationError(null);
    try {
      await clearChatMessages(threadId);
      if (activeThreadIdRef.current !== threadId) return false;
      resetConversationSurface();
      resetThread(threadId);
      return true;
    } catch (error) {
      if (!isAbortError(error)) {
        setOperationError(readableError(error, "清空会话失败，请稍后重试。"));
      }
      return false;
    } finally {
      if (activeThreadIdRef.current === threadId) setIsClearing(false);
    }
  }, [abortCurrentRequest, isClearing, resetConversationSurface, resetThread]);

  const retryHistory = useCallback(() => {
    setHistoryError(null);
    setHistoryReloadKey((value) => value + 1);
  }, []);

  const isUploading =
    imageUpload.uploadState === "signing" || imageUpload.uploadState === "uploading";
  const canSend =
    !isLoadingHistory &&
    !isUploading &&
    !isStreaming &&
    !isClearing &&
    Boolean(input.trim() || imageUpload.selectedImage);

  const status = useMemo(() => {
    if (isClearing) return { name: "clearing", label: "正在清空…" };
    if (isUploading) return { name: "uploading", label: "正在上传图片…" };
    if (isStreaming) return { name: "streaming", label: "正在整理菜谱…" };
    if (isLoadingHistory) return { name: "loading", label: "正在加载历史…" };
    if (historyError || operationError) return { name: "error", label: "需要处理" };
    return { name: "ready", label: "就绪 Ready" };
  }, [historyError, isClearing, isLoadingHistory, isStreaming, isUploading, operationError]);

  const threadViewModels = useMemo(
    () =>
      threads.map((thread) => ({
        ...thread,
        timeLabel: formatThreadTime(thread.updatedAt),
      })),
    [threads],
  );

  const image = imageUpload.selectedImage
    ? {
        src: imageUpload.imagePreviewUrl,
        name: imageUpload.selectedImage.name,
        status:
          imageUpload.uploadState === "success"
            ? "uploaded"
            : imageUpload.uploadState === "signing"
              ? "uploading"
              : imageUpload.uploadState,
        progress: imageUpload.uploadProgress,
        error: imageUpload.error,
      }
    : null;

  return {
    threads: threadViewModels,
    activeThreadId,
    activeThread,
    messages,
    input,
    preferences,
    image,
    isLoadingHistory,
    isUploading,
    isStreaming,
    isClearing,
    historyError,
    operationError,
    canSend,
    status,
    changeInput,
    selectStarterPrompt,
    selectImage,
    removeImage,
    retryImageUpload,
    sendMessage,
    retryMessage,
    togglePreference,
    switchThread,
    newThread,
    clearActiveThread,
    retryHistory,
  };
}
