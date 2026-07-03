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
 * Reports whether both sync systems are no longer actively changing state.
 *
 * @example isSettledSyncStatus(status)
 */
export function isSettledSyncStatus(status: SyncStatus): boolean {
  const dataSettled = status.data.state === "SYNCED" || status.data.state === "DISABLED" || status.data.state === "FAILED";
  const googleSettled = status.googleCalendar.state === "SYNCED" || status.googleCalendar.state === "DISABLED" || status.googleCalendar.state === "FAILED";

  return dataSettled && googleSettled;
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
