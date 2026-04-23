export type AssetSyncState =
  | "DISABLED"
  | "BOOTSTRAPPING"
  | "SYNCED"
  | "PENDING"
  | "SYNCING"
  | "FAILED";

export type PersistenceSyncState = "IDLE" | "SYNCING" | "FAILED" | "DISABLED";

export type AssetSyncStatus = {
  state: AssetSyncState;
  pending: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type PersistenceSyncStatus = {
  state: PersistenceSyncState;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type SyncStatus = {
  assets: AssetSyncStatus;
  persistence: PersistenceSyncStatus;
};
