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
    message: "The affected features are Data sync via rclone and Google Calendar.",
    rows: buildSyncRows(syncStatus)
  };
}

function buildSyncRows(syncStatus: SyncStatus | null): ConnectivitySyncRow[] {
  return [buildDataRow(syncStatus), buildGoogleCalendarRow(syncStatus)];
}

function buildDataRow(syncStatus: SyncStatus | null): ConnectivitySyncRow {
  const data = syncStatus?.data;

  return {
    label: "DATA",
    state: data?.state ?? "UNKNOWN",
    pendingText: pendingText(Boolean(data?.pending || data?.running || data?.state === "FAILED")),
    lastSuccessfulSyncAt: data?.lastSuccessfulSyncAt ?? "Never synced",
    lastError: data?.lastError ?? null
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
