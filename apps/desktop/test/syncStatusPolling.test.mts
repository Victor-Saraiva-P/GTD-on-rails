import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  STARTUP_STATUS_OBSERVATION_MS,
  isSettledSyncStatus,
  shouldStopSyncStatusPolling,
  startupObservationDeadline
} from "../src/features/sync-status/syncStatusPolling.ts";
import type { SyncStatus } from "../src/features/sync-status/types.ts";

function syncStatus(assetState: SyncStatus["assets"]["state"], persistenceState: SyncStatus["persistence"]["state"]): SyncStatus {
  return {
    assets: {
      state: assetState,
      pending: false,
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessfulSyncAt: null,
      lastError: null
    },
    persistence: {
      state: persistenceState,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessfulSyncAt: null,
      lastError: null,
      hasLocalChanges: false,
      hasUnpushedCommits: false
    }
  };
}

describe("sync status polling", () => {
  test("startupObservationDeadline adds the observation window", () => {
    assert.equal(startupObservationDeadline(1_000), 1_000 + STARTUP_STATUS_OBSERVATION_MS);
  });

  test("isSettledSyncStatus returns false while either sync is active", () => {
    assert.equal(isSettledSyncStatus(syncStatus("SYNCING", "IDLE")), false);
    assert.equal(isSettledSyncStatus(syncStatus("SYNCED", "SYNCING")), false);
  });

  test("shouldStopSyncStatusPolling keeps startup failures observable until deadline", () => {
    const failedStatus = syncStatus("FAILED", "FAILED");

    assert.equal(shouldStopSyncStatusPolling(failedStatus, 2_000, 1_500), false);
    assert.equal(shouldStopSyncStatusPolling(failedStatus, 2_000, 2_000), true);
  });
});
