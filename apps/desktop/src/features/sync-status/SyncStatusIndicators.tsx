import type { CSSProperties } from "react";
import { useSyncStatus } from "./SyncStatusProvider";
import type {
  FileSyncState,
  FileSyncStatus,
  GoogleCalendarSyncState,
  GoogleCalendarSyncStatus
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

  // Enforce dd/mm/yyyy ordering regardless of machine locale.
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(value));
}

function fileVisual(state: FileSyncState | null): IndicatorVisual {
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

function googleCalendarVisual(state: GoogleCalendarSyncState | null): IndicatorVisual {
  switch (state) {
    case "SYNCED":
      return { label: "Synced", tone: "idle" };
    case "SYNCING":
      return { label: "Syncing", tone: "active", pulse: true };
    case "PENDING":
      return { label: "Pending", tone: "pending", pulse: true };
    case "FAILED":
      return { label: "Failed", tone: "error" };
    case "DISABLED":
      return { label: "Disabled", tone: "disabled" };
    default:
      return { label: "Unknown", tone: "unknown" };
  }
}

function describeFileStatus(status: FileSyncStatus | null, failed: boolean): string {
  if (!status) {
    return failed ? "File sync status unavailable." : "Loading file sync status.";
  }

  const details = [
    `File sync: ${fileVisual(status.state).label}`,
    status.lastSuccessfulSyncAt ? `Last success: ${formatInstant(status.lastSuccessfulSyncAt)}` : null,
    status.lastError ? `Last error: ${status.lastError}` : null
  ].filter(Boolean);

  return details.join("\n");
}

function describeGoogleCalendarStatus(status: GoogleCalendarSyncStatus | null, failed: boolean): string {
  if (!status) {
    return failed ? "Google Calendar sync status unavailable." : "Loading Google Calendar sync status.";
  }

  const details = [
    `Google Calendar: ${googleCalendarVisual(status.state).label}`,
    status.lastSuccessfulSyncAt ? `Last success: ${formatInstant(status.lastSuccessfulSyncAt)}` : null,
    status.lastError ? `Last error: ${status.lastError}` : null
  ].filter(Boolean);

  return details.join("\n");
}

function FileSyncIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sync-status__svg">
      <path d="M18.2 8.1A7.2 7.2 0 0 0 5.7 6.4L4.3 8.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M4.1 4.7v3.6h3.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M5.8 15.9a7.2 7.2 0 0 0 12.5 1.7l1.4-1.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M19.9 19.3v-3.6h-3.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function GoogleCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sync-status__svg">
      <path d="M6 4.5h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M8 3v4M16 3v4M4 9h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M10 13.2 8.8 14v-1.6l1.2-.7h1.4V17M14 11.8h3.1M14 11.8l-.2 2.1c.4-.3.8-.4 1.3-.4 1.2 0 2 .8 2 1.9 0 1.2-.9 2-2.2 2-.8 0-1.5-.3-1.9-.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" />
    </svg>
  );
}

type SyncIndicatorProps = Readonly<{
  ariaLabel: string;
  title: string;
  visual: IndicatorVisual;
  icon: "calendar" | "data";
}>;

function syncIndicatorClassName(visual: IndicatorVisual): string {
  return `sync-status__item sync-status__item--${visual.tone}${visual.pulse ? " sync-status__item--pulse" : ""}${visual.spin ? " sync-status__item--spin" : ""}`;
}

function syncIndicatorStyle(visual: IndicatorVisual): CSSProperties {
  return {
    "--sync-status-rotation": visual.spin ? "360deg" : "0deg"
  } as CSSProperties;
}

function SyncIndicatorIcon({ icon }: Readonly<Pick<SyncIndicatorProps, "icon">>) {
  if (icon === "calendar") {
    return <GoogleCalendarIcon />;
  }

  return <FileSyncIcon />;
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

type SyncStatusIndicatorRowProps = Readonly<{
  failedBeforeStatus: boolean;
  isLoading: boolean;
  status: ReturnType<typeof useSyncStatus>["status"];
}>;

function DataStatusIndicator({ failedBeforeStatus, isLoading, status }: SyncStatusIndicatorRowProps) {
  const visual = fileVisual(status?.file.state ?? null);

  return (
    <SyncIndicator
      ariaLabel={`File sync ${visual.label.toLowerCase()}`}
      title={describeFileStatus(status?.file ?? null, failedBeforeStatus)}
      visual={loadingVisual(visual, isLoading)}
      icon="data"
    />
  );
}

function GoogleCalendarStatusIndicator({ failedBeforeStatus, isLoading, status }: SyncStatusIndicatorRowProps) {
  const visual = googleCalendarVisual(status?.googleCalendar.state ?? null);

  return (
    <SyncIndicator
      ariaLabel={`Google Calendar sync ${visual.label.toLowerCase()}`}
      title={describeGoogleCalendarStatus(status?.googleCalendar ?? null, failedBeforeStatus)}
      visual={loadingVisual(visual, isLoading)}
      icon="calendar"
    />
  );
}

/**
 * Renders data and Google Calendar sync status indicators in the workspace footer.
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
      <DataStatusIndicator failedBeforeStatus={failedBeforeStatus} isLoading={loadingBeforeStatus} status={status} />
      <GoogleCalendarStatusIndicator failedBeforeStatus={failedBeforeStatus} isLoading={loadingBeforeStatus} status={status} />
    </div>
  );
}
