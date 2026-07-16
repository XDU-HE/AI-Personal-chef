import { DEFAULT_THREAD_TITLE } from "./thread.js";

export const THREADS_STORAGE_KEY = "ai_chef_threads_v1";
export const ACTIVE_THREAD_STORAGE_KEY = "ai_chef_active_thread_id";

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function validIsoDate(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function normalizeThread(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (typeof value.id !== "string" || value.id.trim() === "") {
    return null;
  }

  const now = new Date().toISOString();
  const createdAt = validIsoDate(value.createdAt, now);
  const updatedAt = validIsoDate(value.updatedAt, createdAt);

  return {
    id: value.id.trim(),
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : DEFAULT_THREAD_TITLE,
    preview: typeof value.preview === "string" ? value.preview : "",
    createdAt,
    updatedAt,
  };
}

export function sortThreads(threads) {
  return [...threads].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function normalizeThreads(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduplicated = new Map();
  value.forEach((candidate) => {
    const thread = normalizeThread(candidate);
    if (!thread) {
      return;
    }
    const existing = deduplicated.get(thread.id);
    if (!existing || new Date(thread.updatedAt) >= new Date(existing.updatedAt)) {
      deduplicated.set(thread.id, thread);
    }
  });

  return sortThreads([...deduplicated.values()]);
}

export function readStoredThreads() {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(THREADS_STORAGE_KEY);
    return rawValue ? normalizeThreads(JSON.parse(rawValue)) : [];
  } catch {
    return [];
  }
}

export function readStoredActiveThreadId() {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(ACTIVE_THREAD_STORAGE_KEY);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function writeStoredThreads(threads) {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(THREADS_STORAGE_KEY, JSON.stringify(normalizeThreads(threads)));
    return true;
  } catch {
    return false;
  }
}

export function writeStoredActiveThreadId(threadId) {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  try {
    if (typeof threadId === "string" && threadId.trim()) {
      storage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId.trim());
    } else {
      storage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}
