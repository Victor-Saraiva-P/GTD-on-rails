export type DataSyncState =
  | "DISABLED"
  | "BOOTSTRAPPING"
  | "SYNCED"
  | "PENDING"
  | "SYNCING"
  | "FAILED";

export type GoogleCalendarSyncState = "DISABLED" | "SYNCED" | "PENDING" | "SYNCING" | "FAILED";

export type DataSyncStatus = {
  state: DataSyncState;
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

export type SyncStatus = {
  data: DataSyncStatus;
  googleCalendar: GoogleCalendarSyncStatus;
};
