import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { fetchSyncStatus } from "./api";
import type { SyncStatus } from "./types";

const POLL_INTERVAL_MS = 1000;

type SyncStatusContextValue = {
  isLoading: boolean;
  isPolling: boolean;
  lastFetchFailed: boolean;
  status: SyncStatus | null;
  triggerSyncStatusPolling: () => void;
};

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

function isSettledStatus(status: SyncStatus): boolean {
  const assetsSettled =
    status.assets.state === "SYNCED" ||
    status.assets.state === "DISABLED" ||
    status.assets.state === "FAILED";
  const persistenceSettled =
    status.persistence.state === "IDLE" ||
    status.persistence.state === "DISABLED" ||
    status.persistence.state === "FAILED";

  return assetsSettled && persistenceSettled;
}

export function SyncStatusProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsPolling(false);
  }, []);

  const refreshSyncStatus = useCallback(async () => {
    try {
      const nextStatus = await fetchSyncStatus();

      setStatus(nextStatus);
      setLastFetchFailed(false);

      if (isSettledStatus(nextStatus)) {
        stopPolling();
      }

      return nextStatus;
    } catch {
      setLastFetchFailed(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      return;
    }

    setIsPolling(true);
    intervalRef.current = window.setInterval(() => {
      void refreshSyncStatus();
    }, POLL_INTERVAL_MS);
  }, [refreshSyncStatus]);

  const triggerSyncStatusPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      return;
    }

    startPolling();
    void refreshSyncStatus();
  }, [refreshSyncStatus, startPolling]);

  useEffect(() => {
    void refreshSyncStatus();

    return () => {
      stopPolling();
    };
  }, [refreshSyncStatus, stopPolling]);

  const value = useMemo<SyncStatusContextValue>(
    () => ({
      isLoading,
      isPolling,
      lastFetchFailed,
      status,
      triggerSyncStatusPolling
    }),
    [isLoading, isPolling, lastFetchFailed, status, triggerSyncStatusPolling]
  );

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);

  if (!context) {
    throw new Error("Sync status context not available");
  }

  return context;
}
