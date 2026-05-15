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
    message: "The affected features are GitHub via git and Google Drive via rclone.",
    rows: buildSyncRows(syncStatus)
  };
}

function buildSyncRows(syncStatus: SyncStatus | null): ConnectivitySyncRow[] {
  return [buildGitRow(syncStatus), buildRcloneRow(syncStatus)];
}

function buildGitRow(syncStatus: SyncStatus | null): ConnectivitySyncRow {
  const persistence = syncStatus?.persistence;

  return {
    label: "GIT",
    state: persistence?.state ?? "UNKNOWN",
    pendingText: pendingText(Boolean(persistence?.hasLocalChanges || persistence?.hasUnpushedCommits)),
    lastSuccessfulSyncAt: persistence?.lastSuccessfulSyncAt ?? "Never synced",
    lastError: persistence?.lastError ?? null
  };
}

function buildRcloneRow(syncStatus: SyncStatus | null): ConnectivitySyncRow {
  const assets = syncStatus?.assets;

  return {
    label: "RCLONE",
    state: assets?.state ?? "UNKNOWN",
    pendingText: pendingText(Boolean(assets?.pending || assets?.running || assets?.state === "FAILED")),
    lastSuccessfulSyncAt: assets?.lastSuccessfulSyncAt ?? "Never synced",
    lastError: assets?.lastError ?? null
  };
}

function pendingText(isPending: boolean): string {
  return isPending ? "yes" : "no";
}
