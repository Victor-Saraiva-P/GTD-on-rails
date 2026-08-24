import type { SyncStatus } from "../sync-status/types";

export type ConnectivitySyncRow = {
  label: string;
  state: string;
  pendingText: string;
  lastSuccessfulSyncAt: string;
  lastError: string | null;
};

export type ConnectivityBlockerModel = {
  isBlocked: boolean;
  title: string;
  message: string;
  rows: ConnectivitySyncRow[];
};

/**
 * Builds the offline blocker view model from browser and sync state.
 *
 * @example buildConnectivityBlockerModel(false, status)
 */
export function buildConnectivityBlockerModel(isBrowserOnline: boolean, syncStatus: SyncStatus | null): ConnectivityBlockerModel {
  return {
    isBlocked: !isBrowserOnline,
    title: isBrowserOnline ? "Connection active" : "No internet connection",
    message: "The affected features are File Sync via rclone and Google Calendar.",
    rows: buildSyncRows(syncStatus)
  };
}

function buildSyncRows(syncStatus: SyncStatus | null): ConnectivitySyncRow[] {
  return [buildFileRow(syncStatus), buildGoogleCalendarRow(syncStatus)];
}

function buildFileRow(syncStatus: SyncStatus | null): ConnectivitySyncRow {
  const file = syncStatus?.file;

  return {
    label: "FILES",
    state: file?.state ?? "UNKNOWN",
    pendingText: pendingText(Boolean(file?.pending || file?.running || file?.state === "FAILED")),
    lastSuccessfulSyncAt: file?.lastSuccessfulSyncAt ?? "Never synced",
    lastError: file?.lastError ?? null
  };
}

function buildGoogleCalendarRow(syncStatus: SyncStatus | null): ConnectivitySyncRow {
  const googleCalendar = syncStatus?.googleCalendar;

  return {
    label: "GCAL",
    state: googleCalendar?.state ?? "UNKNOWN",
    pendingText: pendingText(Boolean(googleCalendar?.pending || googleCalendar?.running || googleCalendar?.state === "FAILED")),
    lastSuccessfulSyncAt: googleCalendar?.lastSuccessfulSyncAt ?? "Never synced",
    lastError: googleCalendar?.lastError ?? null
  };
}

function pendingText(isPending: boolean): string {
  return isPending ? "yes" : "no";
}
