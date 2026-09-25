import type { SyncStatus } from "./types";

export const STARTUP_STATUS_OBSERVATION_MS = 10_000;

/**
 * Returns the timestamp until which startup status polling should ignore settled failures.
 *
 * @example startupObservationDeadline(1000)
 */
export function startupObservationDeadline(startedAt: number): number {
  return startedAt + STARTUP_STATUS_OBSERVATION_MS;
}

/**
 * Reports whether all three sync systems are no longer actively changing state.
 *
 * @example isSettledSyncStatus(status)
 */
export function isSettledSyncStatus(status: SyncStatus): boolean {
  const fileSettled = settledWithPendingCount(status.file.state, status.file.pendingCount);
  const googleSettled = settledWithPendingCount(
    status.googleCalendar.state,
    status.googleCalendar.pendingCount
  );
  const databaseSettled = settledWithPendingCount(status.database.state, status.database.pendingCount);

  return fileSettled && googleSettled && databaseSettled;
}

function settledWithPendingCount(state: string, pendingCount: number): boolean {
  if (state === "FAILED") return pendingCount === 0;
  return state === "SYNCED" || state === "DISABLED";
}

/**
 * Keeps startup polling alive briefly so stale failures can recover into fresh status.
 *
 * @example shouldStopSyncStatusPolling(status, null, Date.now())
 */
export function shouldStopSyncStatusPolling(status: SyncStatus, startupDeadline: number | null, now: number): boolean {
  if (!isSettledSyncStatus(status)) {
    return false;
  }

  return startupDeadline === null || now >= startupDeadline;
}
