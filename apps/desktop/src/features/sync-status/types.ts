export type FileSyncState =
  | "DISABLED"
  | "BOOTSTRAPPING"
  | "SYNCED"
  | "PENDING"
  | "SYNCING"
  | "FAILED"
  | "CONFLICT"
  | "REBOOTSTRAP_REQUIRED";

export type GoogleCalendarSyncState = "DISABLED" | "SYNCED" | "PENDING" | "SYNCING" | "FAILED";

export type DatabaseSyncState = "DISABLED" | "SYNCED" | "PENDING" | "SYNCING" | "FAILED" | "CONFLICT" | "REBOOTSTRAP_REQUIRED";

export type FileSyncStatus = {
  state: FileSyncState;
  pending: boolean;
  running: boolean;
  pendingCount: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type GoogleCalendarSyncStatus = {
  state: GoogleCalendarSyncState;
  pending: boolean;
  running: boolean;
  pendingCount: number;
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
  conflictCount: number;
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

export type SyncConflictSummary = {
  id: number;
  objectType: string;
  objectId: string;
  localOperationId: string | null;
  remoteRevision: number;
  remoteCursor: number;
  createdAt: string;
};

export type SyncConflictDetail = {
  id: number;
  objectType: string;
  objectId: string;
  remoteRevision: number;
  createdAt: string;
  mergeSupported: boolean;
  baseContent: string | null;
  localContent: string | null;
  remoteContent: string | null;
};

export type SyncConflictChoice = "LOCAL" | "REMOTE" | "MERGED";

export type RebootstrapResult = {
  recoverySnapshot: string;
  datasetEpoch: string;
  cursor: number;
};
