import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  clearChatMessages,
  fetchChatMessages,
  streamChat,
} from "../src/api/chat.js";
import { validateImageFile } from "../src/utils/image.js";
import {
  readStoredActiveThreadId,
  readStoredThreads,
  writeStoredActiveThreadId,
  writeStoredThreads,
} from "../src/utils/storage.js";
import { createThreadRecord, createThreadTitle } from "../src/utils/thread.js";
import { createUuid } from "../src/utils/uuid.js";

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;

after(() => {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
});

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("UUID fallback contract and thread title truncation", () => {
  assert.match(
    createUuid(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(createThreadTitle("  番茄   鸡蛋  "), "番茄 鸡蛋");
  assert.equal(createThreadTitle("一二三四五六七八九十一二三四五六七八九十一二三四五", 18), "一二三四五六七八九十一二三四五六七八…");
});

test("localStorage thread index repairs corrupted values and persists the active thread", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };

  values.set("ai_chef_threads_v1", "not-json");
  assert.deepEqual(readStoredThreads(), []);

  const thread = createThreadRecord({ id: "thread-test" });
  assert.equal(writeStoredThreads([thread]), true);
  assert.equal(writeStoredActiveThreadId(thread.id), true);
  assert.equal(readStoredThreads()[0].id, thread.id);
  assert.equal(readStoredActiveThreadId(), thread.id);
});

test("history and clear requests use the active thread query", async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method });
    if (options.method === "DELETE") {
      return jsonResponse({ thread_id: "thread-a", cleared: true });
    }
    return jsonResponse({
      thread_id: "thread-a",
      messages: [{ role: "user", content: "番茄和鸡蛋" }],
    });
  };

  const messages = await fetchChatMessages("thread-a");
  assert.equal(messages[0].content, "番茄和鸡蛋");
  const cleared = await clearChatMessages("thread-a");
  assert.equal(cleared.cleared, true);
  assert.match(calls[0].url, /\/api\/v1\/chat\/messages\?thread_id=thread-a$/);
  assert.equal(calls[1].method, "DELETE");
});

test("raw UTF-8 stream reconstructs multibyte chunks without duplication", async () => {
  const encoded = new TextEncoder().encode("你好，菜谱");
  const pieces = [encoded.slice(0, 1), encoded.slice(1, 5), encoded.slice(5, 8), encoded.slice(8)];
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          pieces.forEach((piece) => controller.enqueue(piece));
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );

  let incremental = "";
  const complete = await streamChat({
    message: "推荐晚餐",
    imageUrl: null,
    threadId: "thread-stream",
    onChunk: (chunk) => {
      incremental += chunk;
    },
  });
  assert.equal(incremental, "你好，菜谱");
  assert.equal(complete, "你好，菜谱");
});

test("image validation accepts backend formats and rejects oversized files", () => {
  assert.equal(
    validateImageFile({ name: "food.webp", type: "image/webp", size: 1024 }).valid,
    true,
  );
  assert.equal(
    validateImageFile({ name: "food.bmp", type: "image/bmp", size: 1024 }).code,
    "unsupported_type",
  );
  assert.equal(
    validateImageFile({ name: "food.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 }).code,
    "file_too_large",
  );
});
