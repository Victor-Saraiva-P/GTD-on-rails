import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { buildConnectivityBlockerModel } from "../src/features/connectivity/connectivityBlocker.ts";
import type { SyncStatus } from "../src/features/sync-status/types.ts";

function syncStatus(): SyncStatus {
  return {
    assets: {
      state: "SYNCED",
      pending: false,
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessfulSyncAt: "2026-05-01T00:00:05Z",
      lastError: null
    },
    persistence: {
      state: "IDLE",
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessfulSyncAt: "2026-05-01T00:00:06Z",
      lastError: null,
      hasLocalChanges: false,
      hasUnpushedCommits: false
    }
  };
}

describe("connectivity blocker", () => {
  test("blocks only when browser is offline", () => {
    assert.equal(buildConnectivityBlockerModel(false, syncStatus()).isBlocked, true);
    assert.equal(buildConnectivityBlockerModel(true, failedSyncStatus()).isBlocked, false);
  });

  test("reports pending git changes", () => {
    const status = syncStatus();
    status.persistence.hasUnpushedCommits = true;

    const model = buildConnectivityBlockerModel(false, status);

    assert.equal(model.rows[0].label, "GIT");
    assert.equal(model.rows[0].pendingText, "yes");
  });

  test("reports pending rclone sync", () => {
    const status = syncStatus();
    status.assets.pending = true;

    const model = buildConnectivityBlockerModel(false, status);

    assert.equal(model.rows[1].label, "RCLONE");
    assert.equal(model.rows[1].pendingText, "yes");
  });
});

function failedSyncStatus(): SyncStatus {
  const status = syncStatus();
  status.assets.state = "FAILED";
  status.persistence.state = "FAILED";
  return status;
}
