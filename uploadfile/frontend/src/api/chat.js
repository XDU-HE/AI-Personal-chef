import {
  ApiError,
  buildApiUrl,
  createResponseError,
  requestJson,
} from "./client.js";

function requireThreadId(threadId) {
  if (typeof threadId !== "string" || threadId.trim() === "") {
    throw new TypeError("threadId 必须是非空字符串。");
  }
  return threadId.trim();
}

export async function fetchChatMessages(threadId, { signal } = {}) {
  const normalizedThreadId = requireThreadId(threadId);
  const payload = await requestJson("/chat/messages", {
    method: "GET",
    query: { thread_id: normalizedThreadId },
    signal,
    fallbackMessage: "加载会话记录失败，请稍后重试。",
  });

  if (!Array.isArray(payload?.messages)) {
    throw new ApiError("历史消息数据格式不正确。", {
      status: 200,
      body: payload,
      code: "invalid_history",
    });
  }

  return payload.messages;
}

export async function clearChatMessages(threadId, { signal } = {}) {
  const normalizedThreadId = requireThreadId(threadId);
  const payload = await requestJson("/chat/messages", {
    method: "DELETE",
    query: { thread_id: normalizedThreadId },
    signal,
    fallbackMessage: "清空会话失败，请稍后重试。",
  });

  if (payload?.cleared !== true) {
    throw new ApiError("服务器未确认会话已清空。", {
      status: 200,
      body: payload,
      code: "clear_not_confirmed",
    });
  }

  return payload;
}

export async function streamChat({
  message,
  imageUrl = null,
  threadId,
  signal,
  onChunk,
} = {}) {
  if (typeof message !== "string") {
    throw new TypeError("message 必须是字符串。");
  }
  if (imageUrl !== null && imageUrl !== undefined && typeof imageUrl !== "string") {
    throw new TypeError("imageUrl 必须是字符串或 null。");
  }

  const normalizedThreadId = requireThreadId(threadId);
  const response = await fetch(buildApiUrl("/chat/stream"), {
    method: "POST",
    headers: {
      Accept: "text/plain",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      image_url: imageUrl || null,
      thread_id: normalizedThreadId,
    }),
    signal,
  });

  if (!response.ok) {
    throw await createResponseError(response, "发送消息失败，请稍后重试。");
  }

  if (!response.body) {
    throw new ApiError("服务器没有返回可读取的消息流。", {
      status: response.status,
      code: "missing_stream",
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let completeText = "";

  const emitChunk = (chunk) => {
    if (!chunk) {
      return;
    }
    completeText += chunk;
    if (typeof onChunk === "function") {
      onChunk(chunk);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      emitChunk(decoder.decode(value, { stream: true }));
    }
    emitChunk(decoder.decode());
    return completeText;
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // The fetch signal may have already closed the stream.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
