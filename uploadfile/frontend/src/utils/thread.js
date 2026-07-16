import { createUuid } from "./uuid.js";

export const DEFAULT_THREAD_TITLE = "新对话";
export const MAX_THREAD_TITLE_LENGTH = 24;

function toIsoDate(value, fallback) {
  const date = new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function createThreadRecord(overrides = {}) {
  const now = new Date().toISOString();
  const createdAt = toIsoDate(overrides.createdAt, now);
  const updatedAt = toIsoDate(overrides.updatedAt, createdAt);

  return {
    id:
      typeof overrides.id === "string" && overrides.id.trim()
        ? overrides.id.trim()
        : createUuid(),
    title:
      typeof overrides.title === "string" && overrides.title.trim()
        ? overrides.title.trim()
        : DEFAULT_THREAD_TITLE,
    preview: typeof overrides.preview === "string" ? overrides.preview : "",
    createdAt,
    updatedAt,
  };
}

export function createThreadTitle(message, maxLength = MAX_THREAD_TITLE_LENGTH) {
  if (typeof message !== "string") {
    return DEFAULT_THREAD_TITLE;
  }

  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return DEFAULT_THREAD_TITLE;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

export const generateThreadId = createUuid;
