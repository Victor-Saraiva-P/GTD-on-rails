import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { buildConnectivityBlockerModel } from "../src/features/connectivity/connectivityBlocker.ts";
import type { SyncStatus } from "../src/features/sync-status/types.ts";

function syncStatus(): SyncStatus {
  return {
    file: {
      state: "SYNCED",
      pending: false,
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessfulSyncAt: "2026-05-01T00:00:05Z",
      lastError: null
    },
    googleCalendar: {
      state: "SYNCED",
      pending: false,
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessfulSyncAt: "2026-05-01T00:00:07Z",
      lastError: null
    }
  };
}

describe("connectivity blocker", () => {
  test("blocks only when browser is offline", () => {
    assert.equal(buildConnectivityBlockerModel(false, syncStatus()).isBlocked, true);
    assert.equal(buildConnectivityBlockerModel(true, failedSyncStatus()).isBlocked, false);
  });

  test("reports pending file sync", () => {
    const status = syncStatus();
    status.file.pending = true;

    const model = buildConnectivityBlockerModel(false, status);

    assert.equal(model.rows[0].label, "FILES");
    assert.equal(model.rows[0].pendingText, "yes");
  });

  test("reports pending Google Calendar sync", () => {
    const status = syncStatus();
    status.googleCalendar.pending = true;

    const model = buildConnectivityBlockerModel(false, status);

    assert.equal(model.rows[1].label, "GCAL");
    assert.equal(model.rows[1].pendingText, "yes");
  });
});

function failedSyncStatus(): SyncStatus {
  const status = syncStatus();
  status.file.state = "FAILED";
  status.googleCalendar.state = "FAILED";
  return status;
}
