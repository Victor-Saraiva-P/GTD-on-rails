import type { CSSProperties } from "react";
import { useSyncStatus } from "./SyncStatusProvider";
import type {
  AssetSyncState,
  AssetSyncStatus,
  PersistenceSyncState,
  PersistenceSyncStatus
} from "./types";

type IndicatorVisual = {
  label: string;
  tone: "idle" | "active" | "pending" | "setup" | "error" | "disabled" | "unknown";
  spin?: boolean;
  pulse?: boolean;
};

function formatInstant(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(value));
}

function assetVisual(state: AssetSyncState | null): IndicatorVisual {
  switch (state) {
    case "SYNCED":
      return { label: "Synced", tone: "idle" };
    case "SYNCING":
      return { label: "Syncing", tone: "active", pulse: true };
    case "PENDING":
      return { label: "Pending", tone: "pending", pulse: true };
    case "BOOTSTRAPPING":
      return { label: "Bootstrapping", tone: "setup", spin: true };
    case "FAILED":
      return { label: "Failed", tone: "error" };
    case "DISABLED":
      return { label: "Disabled", tone: "disabled" };
    default:
      return { label: "Unknown", tone: "unknown" };
  }
}

function persistenceVisual(state: PersistenceSyncState | null): IndicatorVisual {
  switch (state) {
    case "IDLE":
      return { label: "Idle", tone: "idle" };
    case "SYNCING":
      return { label: "Syncing", tone: "active", pulse: true };
    case "FAILED":
      return { label: "Failed", tone: "error" };
    case "DISABLED":
      return { label: "Disabled", tone: "disabled" };
    default:
      return { label: "Unknown", tone: "unknown" };
  }
}

function describeAssetStatus(status: AssetSyncStatus | null, failed: boolean): string {
  if (!status) {
    return failed ? "Rclone sync status unavailable." : "Loading rclone sync status.";
  }

  const details = [
    `Rclone: ${assetVisual(status.state).label}`,
    status.lastSuccessfulSyncAt ? `Last success: ${formatInstant(status.lastSuccessfulSyncAt)}` : null,
    status.lastError ? `Last error: ${status.lastError}` : null
  ].filter(Boolean);

  return details.join("\n");
}

function describePersistenceStatus(status: PersistenceSyncStatus | null, failed: boolean): string {
  if (!status) {
    return failed ? "Git persistence sync status unavailable." : "Loading Git persistence sync status.";
  }

  const details = [
    `Git persistence: ${persistenceVisual(status.state).label}`,
    status.lastSuccessfulSyncAt ? `Last success: ${formatInstant(status.lastSuccessfulSyncAt)}` : null,
    status.lastError ? `Last error: ${status.lastError}` : null
  ].filter(Boolean);

  return details.join("\n");
}

function GoogleDriveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sync-status__svg">
      <path d="M8.3 3h7.4l5.2 9-3.7 6.4H9.8L4.6 9.4 8.3 3Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.3 3 13.5 12" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.7 3 10.5 12" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.6 9.4h10.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.8 18.4 15 9.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sync-status__svg">
      <path
        d="M12 3.2a8.8 8.8 0 0 0-2.8 17.2c.4.1.5-.2.5-.4v-1.6c-2.1.5-2.6-.9-2.8-1.3-.1-.4-.6-1.3-1-1.6-.4-.2-.9-.7 0-.7.8 0 1.4.7 1.6 1 .9 1.5 2.4 1.1 3 .8.1-.6.4-1.1.7-1.3-1.9-.2-3.9-.9-3.9-4.2 0-.9.3-1.7.9-2.3-.1-.2-.4-1.1.1-2.2 0 0 .7-.2 2.4.9a8 8 0 0 1 4.4 0c1.7-1.1 2.4-.9 2.4-.9.5 1.1.2 2 .1 2.2.6.6.9 1.4.9 2.3 0 3.2-2 3.9-3.9 4.2.3.3.6.8.6 1.6V20c0 .2.1.5.5.4A8.8 8.8 0 0 0 12 3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

type SyncIndicatorProps = {
  ariaLabel: string;
  title: string;
  visual: IndicatorVisual;
  icon: "drive" | "github";
};

function syncIndicatorClassName(visual: IndicatorVisual): string {
  return `sync-status__item sync-status__item--${visual.tone}${visual.pulse ? " sync-status__item--pulse" : ""}${visual.spin ? " sync-status__item--spin" : ""}`;
}

function syncIndicatorStyle(visual: IndicatorVisual): CSSProperties {
  return {
    "--sync-status-rotation": visual.spin ? "360deg" : "0deg"
  } as CSSProperties;
}

function SyncIndicatorIcon({ icon }: Pick<SyncIndicatorProps, "icon">) {
  return icon === "drive" ? <GoogleDriveIcon /> : <GitHubIcon />;
}

function SyncIndicator({ ariaLabel, title, visual, icon }: SyncIndicatorProps) {
  return (
    <span
      className={syncIndicatorClassName(visual)}
      aria-label={ariaLabel}
      role="img"
      title={title}
      style={syncIndicatorStyle(visual)}
    >
      <SyncIndicatorIcon icon={icon} />
    </span>
  );
}

function loadingVisual(visual: IndicatorVisual, isLoading: boolean): IndicatorVisual {
  return isLoading ? { label: "Loading", tone: "unknown", pulse: true } : visual;
}

type SyncStatusIndicatorRowProps = {
  failedBeforeStatus: boolean;
  isLoading: boolean;
  status: ReturnType<typeof useSyncStatus>["status"];
};

function DriveStatusIndicator({ failedBeforeStatus, isLoading, status }: SyncStatusIndicatorRowProps) {
  const visual = assetVisual(status?.assets.state ?? null);

  return (
    <SyncIndicator
      ariaLabel={`Rclone sync ${visual.label.toLowerCase()}`}
      title={describeAssetStatus(status?.assets ?? null, failedBeforeStatus)}
      visual={loadingVisual(visual, isLoading)}
      icon="drive"
    />
  );
}

function GitStatusIndicator({ failedBeforeStatus, isLoading, status }: SyncStatusIndicatorRowProps) {
  const visual = persistenceVisual(status?.persistence.state ?? null);

  return (
    <SyncIndicator
      ariaLabel={`Git persistence sync ${visual.label.toLowerCase()}`}
      title={describePersistenceStatus(status?.persistence ?? null, failedBeforeStatus)}
      visual={loadingVisual(visual, isLoading)}
      icon="github"
    />
  );
}

/**
 * Renders asset and persistence sync status indicators in the workspace footer.
 *
 * @example <SyncStatusIndicators />
 */
export function SyncStatusIndicators() {
  const { isLoading, isPolling, lastFetchFailed, status } = useSyncStatus();
  const groupLabel = isPolling ? "Synchronization in progress" : "Synchronization status";
  const failedBeforeStatus = lastFetchFailed && !status;
  const loadingBeforeStatus = isLoading && !status;

  return (
    <div className="sync-status" aria-label={groupLabel}>
      <DriveStatusIndicator failedBeforeStatus={failedBeforeStatus} isLoading={loadingBeforeStatus} status={status} />
      <GitStatusIndicator failedBeforeStatus={failedBeforeStatus} isLoading={loadingBeforeStatus} status={status} />
    </div>
  );
}
