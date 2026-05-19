import { useEffect, useState, type PropsWithChildren } from "react";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import { buildConnectivityBlockerModel, type ConnectivitySyncRow } from "./connectivityBlocker";

const OFFLINE_CHECK_INTERVAL_MS = 2000;

function browserOnline(): boolean {
  return navigator.onLine;
}

function useBrowserConnectivity(): boolean {
  const [isOnline, setIsOnline] = useState(browserOnline);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(browserOnline());
    const interval = window.setInterval(updateOnlineState, OFFLINE_CHECK_INTERVAL_MS);

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  return isOnline;
}

function useOfflineSyncPolling(isBlocked: boolean, triggerSyncStatusPolling: () => void) {
  useEffect(() => {
    if (!isBlocked) return;

    triggerSyncStatusPolling();
    const interval = window.setInterval(triggerSyncStatusPolling, OFFLINE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isBlocked, triggerSyncStatusPolling]);
}

function SyncStatusLine({ row }: { row: ConnectivitySyncRow }) {
  return (
    <div className="connectivity-blocker__sync-row">
      <p className="boot-loader__line"><span className="boot-loader__status">[{row.label}]</span> state: {row.state}</p>
      <p className="boot-loader__line">pending upload: {row.pendingText}</p>
      <p className="boot-loader__line">last successful sync: {row.lastSuccessfulSyncAt}</p>
      {row.lastError ? <p className="boot-loader__line connectivity-blocker__error">error: {row.lastError}</p> : null}
    </div>
  );
}

/**
 * Blocks the app while the browser reports no internet access.
 *
 * @example <ConnectivityBlocker><AppShell /></ConnectivityBlocker>
 */
export function ConnectivityBlocker({ children }: PropsWithChildren) {
  const isBrowserOnline = useBrowserConnectivity();
  const { status, triggerSyncStatusPolling } = useSyncStatus();
  const model = buildConnectivityBlockerModel(isBrowserOnline, status);

  useOfflineSyncPolling(model.isBlocked, triggerSyncStatusPolling);
  if (!model.isBlocked) return children;

  return (
    <div className="boot-loader connectivity-blocker">
      <div className="boot-loader__terminal">
        <p className="boot-loader__brand">GTD ON RAILS v1.0.0</p>
        <p className="boot-loader__line"><span className="boot-loader__status">[OFFLINE]</span> {model.title}</p>
        <p className="boot-loader__line connectivity-blocker__message">{model.message}</p>
        {model.rows.map((row) => <SyncStatusLine key={row.label} row={row} />)}
        <p className="boot-loader__line"><span className="boot-loader__status">[WAIT]</span> Checking connection<span className="boot-loader__cursor">_</span></p>
      </div>
    </div>
  );
}
