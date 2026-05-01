import assert from "node:assert/strict";
import test, { describe, afterEach, mock } from "node:test";

import { fetchSyncStatus } from "../src/features/sync-status/api.ts";
import type { SyncStatus } from "../src/features/sync-status/types.ts";

describe("sync-status API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetchSyncStatus returns current status", async () => {
    const mockResponse: SyncStatus = {
      assets: {
        state: "SYNCED",
        pending: false,
        running: false,
        lastStartedAt: "2026-05-01T00:00:00Z",
        lastFinishedAt: "2026-05-01T00:00:05Z",
        lastSuccessfulSyncAt: "2026-05-01T00:00:05Z",
        lastError: null
      },
      persistence: {
        state: "IDLE",
        lastStartedAt: "2026-05-01T00:00:00Z",
        lastFinishedAt: "2026-05-01T00:00:05Z",
        lastSuccessfulSyncAt: "2026-05-01T00:00:05Z",
        lastError: null
      }
    };
    
    globalThis.fetch = mock.fn(async () => {
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const status = await fetchSyncStatus();
    assert.deepEqual(status, mockResponse);
  });
});
