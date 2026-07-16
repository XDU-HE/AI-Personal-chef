import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACTIVE_THREAD_STORAGE_KEY,
  THREADS_STORAGE_KEY,
  normalizeThread,
  readStoredActiveThreadId,
  readStoredThreads,
  sortThreads,
  writeStoredActiveThreadId,
  writeStoredThreads,
} from "../utils/storage.js";
import {
  DEFAULT_THREAD_TITLE,
  createThreadRecord,
} from "../utils/thread.js";

let fallbackThread;

function createInitialState() {
  const storedThreads = readStoredThreads();
  fallbackThread ??= createThreadRecord();
  const threads = storedThreads.length > 0 ? storedThreads : [{ ...fallbackThread }];
  const storedActiveThreadId = readStoredActiveThreadId();
  const activeThreadId = threads.some((thread) => thread.id === storedActiveThreadId)
    ? storedActiveThreadId
    : threads[0].id;

  return { threads, activeThreadId };
}

export function useConversationStore() {
  const [initialState] = useState(createInitialState);
  const [threads, setThreads] = useState(initialState.threads);
  const [activeThreadId, setActiveThreadId] = useState(initialState.activeThreadId);

  useEffect(() => {
    writeStoredThreads(threads);
  }, [threads]);

  useEffect(() => {
    writeStoredActiveThreadId(activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    if (threads.some((thread) => thread.id === activeThreadId)) {
      return;
    }
    setActiveThreadId(threads[0]?.id ?? null);
  }, [activeThreadId, threads]);

  useEffect(() => {
    if (typeof globalThis.addEventListener !== "function") {
      return undefined;
    }

    const handleStorageChange = (event) => {
      if (event.key !== THREADS_STORAGE_KEY && event.key !== ACTIVE_THREAD_STORAGE_KEY) {
        return;
      }

      const storedThreads = readStoredThreads();
      if (storedThreads.length === 0) {
        return;
      }
      const storedActiveThreadId = readStoredActiveThreadId();
      setThreads(storedThreads);
      setActiveThreadId(
        storedThreads.some((thread) => thread.id === storedActiveThreadId)
          ? storedActiveThreadId
          : storedThreads[0].id,
      );
    };

    globalThis.addEventListener("storage", handleStorageChange);
    return () => globalThis.removeEventListener("storage", handleStorageChange);
  }, []);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

  const createThread = useCallback((overrides = {}) => {
    const thread = createThreadRecord(overrides);
    setThreads((currentThreads) =>
      sortThreads([thread, ...currentThreads.filter((item) => item.id !== thread.id)]),
    );
    setActiveThreadId(thread.id);
    return thread;
  }, []);

  const selectThread = useCallback(
    (threadId) => {
      if (!threads.some((thread) => thread.id === threadId)) {
        return false;
      }
      setActiveThreadId(threadId);
      return true;
    },
    [threads],
  );

  const updateThread = useCallback((threadId, update) => {
    setThreads((currentThreads) => {
      let changed = false;
      const nextThreads = currentThreads.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }

        const patch = typeof update === "function" ? update(thread) : update;
        if (!patch || typeof patch !== "object") {
          return thread;
        }

        const normalized = normalizeThread({
          ...thread,
          ...patch,
          id: thread.id,
          createdAt: thread.createdAt,
          updatedAt: patch.updatedAt ?? new Date().toISOString(),
        });
        if (!normalized) {
          return thread;
        }
        changed = true;
        return normalized;
      });

      return changed ? sortThreads(nextThreads) : currentThreads;
    });
  }, []);

  const resetThread = useCallback(
    (threadId = activeThreadId) => {
      if (!threadId) {
        return;
      }
      updateThread(threadId, {
        title: DEFAULT_THREAD_TITLE,
        preview: "",
        updatedAt: new Date().toISOString(),
      });
    },
    [activeThreadId, updateThread],
  );

  return {
    threads,
    activeThreadId,
    activeThread,
    createThread,
    selectThread,
    updateThread,
    resetThread,
  };
}
