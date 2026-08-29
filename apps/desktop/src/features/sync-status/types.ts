export type FileSyncState =
  | "DISABLED"
  | "BOOTSTRAPPING"
  | "SYNCED"
  | "PENDING"
  | "SYNCING"
  | "FAILED";

export type GoogleCalendarSyncState = "DISABLED" | "SYNCED" | "PENDING" | "SYNCING" | "FAILED";

export type DatabaseSyncState = "DISABLED" | "SYNCED" | "PENDING" | "SYNCING" | "FAILED";

export type FileSyncStatus = {
  state: FileSyncState;
  pending: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type GoogleCalendarSyncStatus = {
  state: GoogleCalendarSyncState;
  pending: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type DatabaseSyncStatus = {
  state: DatabaseSyncState;
  pending: boolean;
  running: boolean;
  pendingCount: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type SyncStatus = {
  file: FileSyncStatus;
  googleCalendar: GoogleCalendarSyncStatus;
  database: DatabaseSyncStatus;
};
