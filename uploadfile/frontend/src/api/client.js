const DEFAULT_API_BASE_URL = "/api/v1";

export function normalizeApiBaseUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_API_BASE_URL;
  }

  const normalized = value.trim().replace(/\/+$/, "");
  return normalized === "" || normalized === "/" ? "" : normalized;
}

const viteEnvironment = import.meta.env ?? {};

export const API_BASE_URL = normalizeApiBaseUrl(
  viteEnvironment.VITE_API_BASE_URL ?? viteEnvironment.VITE_API_BASE,
);

export class ApiError extends Error {
  constructor(message, { status = 0, body = null, code = "api_error" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

export function buildApiUrl(path, query = undefined) {
  const normalizedPath = String(path ?? "").startsWith("/")
    ? String(path ?? "")
    : `/${String(path ?? "")}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  if (!query) {
    return url;
  }

  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  });

  const serializedQuery = search.toString();
  return serializedQuery ? `${url}?${serializedQuery}` : url;
}

function messageFromPayload(payload, fallbackMessage) {
  if (typeof payload === "string" && payload.trim()) {
    const text = payload.trim();
    if (!text.startsWith("<") && text.length <= 300) {
      return text;
    }
    return fallbackMessage;
  }

  if (payload && typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }

  if (Array.isArray(payload?.detail)) {
    const messages = payload.detail
      .map((item) => (typeof item?.msg === "string" ? item.msg : null))
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join("；");
    }
  }

  if (payload && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  return fallbackMessage;
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

export async function createResponseError(response, fallbackMessage = "请求失败，请稍后重试。") {
  const body = await readResponsePayload(response);
  return new ApiError(messageFromPayload(body, fallbackMessage), {
    status: response.status,
    body,
    code: "http_error",
  });
}

export async function requestJson(
  path,
  { query, fallbackMessage, headers, ...requestOptions } = {},
) {
  const response = await fetch(buildApiUrl(path, query), {
    ...requestOptions,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    throw await createResponseError(response, fallbackMessage);
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new ApiError("服务器返回了无法识别的数据。", {
      status: response.status,
      body: cause,
      code: "invalid_json",
    });
  }
}

export function createAbortError(message = "请求已取消。") {
  if (typeof DOMException === "function") {
    return new DOMException(message, "AbortError");
  }

  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function isAbortError(error) {
  return error?.name === "AbortError";
}
