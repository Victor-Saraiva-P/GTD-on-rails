import assert from "node:assert/strict";
import test, { afterEach, describe, mock } from "node:test";

import { evictBackendCache } from "../src/lib/api/cache.ts";

describe("evictBackendCache", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("calls POST /maintenance/cache/evict", async () => {
    const fetchMock = mock.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(null, { status: 204 });
    });
    globalThis.fetch = fetchMock;

    await evictBackendCache();

    assert.equal(fetchMock.mock.callCount(), 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.ok(String(url).endsWith("/maintenance/cache/evict"));
    assert.equal(init?.method, "POST");
  });

  test("handles failure gracefully without throwing", async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error("Network down");
    });

    await assert.doesNotReject(async () => {
      await evictBackendCache();
    });
  });
});
