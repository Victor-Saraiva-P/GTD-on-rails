import {
  createContext,
  type MutableRefObject,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { fetchSyncStatus } from "./api";
import { shouldStopSyncStatusPolling, startupObservationDeadline } from "./syncStatusPolling";
import type { SyncStatus } from "./types";

const POLL_INTERVAL_MS = 1000;

type SyncStatusContextValue = {
  isLoading: boolean;
  isPolling: boolean;
  lastFetchFailed: boolean;
  status: SyncStatus | null;
  triggerSyncStatusPolling: () => void;
};

type SyncStatusState = {
  isLoading: boolean;
  isPolling: boolean;
  lastFetchFailed: boolean;
  setIsLoading: (value: boolean) => void;
  setIsPolling: (value: boolean) => void;
  setLastFetchFailed: (value: boolean) => void;
  setStatus: (status: SyncStatus | null) => void;
  status: SyncStatus | null;
};

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

function usePollingRef() {
  const intervalRef = useRef<number | null>(null);

  const clearPollingInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { clearPollingInterval, intervalRef };
}

function useSyncStatusState(): SyncStatusState {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);

  return {
    isLoading,
    isPolling,
    lastFetchFailed,
    setIsLoading,
    setIsPolling,
    setLastFetchFailed,
    setStatus,
    status
  };
}

function useStopPolling(state: SyncStatusState, clearPollingInterval: () => void) {
  return useCallback(() => {
    clearPollingInterval();
    state.setIsPolling(false);
  }, [clearPollingInterval, state.setIsPolling]);
}

function setSuccessfulStatus(
  state: SyncStatusState,
  nextStatus: SyncStatus,
  startupDeadlineRef: MutableRefObject<number | null>,
  stopPolling: () => void
) {
  state.setStatus(nextStatus);
  state.setLastFetchFailed(false);

  if (shouldStopSyncStatusPolling(nextStatus, startupDeadlineRef.current, Date.now())) {
    startupDeadlineRef.current = null;
    stopPolling();
  }
}

function useRefreshSyncStatus(
  state: SyncStatusState,
  startupDeadlineRef: MutableRefObject<number | null>,
  stopPolling: () => void
) {
  return useCallback(async () => {
    try {
      const nextStatus = await fetchSyncStatus();

      setSuccessfulStatus(state, nextStatus, startupDeadlineRef, stopPolling);
      return nextStatus;
    } catch {
      state.setLastFetchFailed(true);
      return null;
    } finally {
      state.setIsLoading(false);
    }
  }, [state.setIsLoading, state.setLastFetchFailed, state.setStatus, startupDeadlineRef, stopPolling]);
}

function useStartPolling(
  state: SyncStatusState,
  intervalRef: MutableRefObject<number | null>,
  refreshSyncStatus: () => Promise<SyncStatus | null>
) {
  return useCallback(() => {
    if (intervalRef.current !== null) {
      return;
    }

    state.setIsPolling(true);
    intervalRef.current = window.setInterval(() => void refreshSyncStatus(), POLL_INTERVAL_MS);
  }, [intervalRef, refreshSyncStatus, state.setIsPolling]);
}

function useTriggerSyncStatusPolling(
  intervalRef: MutableRefObject<number | null>,
  refreshSyncStatus: () => Promise<SyncStatus | null>,
  startPolling: () => void
) {
  return useCallback(() => {
    if (intervalRef.current !== null) {
      return;
    }

    startPolling();
    void refreshSyncStatus();
  }, [intervalRef, refreshSyncStatus, startPolling]);
}

function useInitialSyncStatusRefresh(
  refreshSyncStatus: () => Promise<SyncStatus | null>,
  startPolling: () => void,
  startupDeadlineRef: MutableRefObject<number | null>,
  stopPolling: () => void
) {
  useEffect(() => {
    startupDeadlineRef.current = startupObservationDeadline(Date.now());
    startPolling();
    void refreshSyncStatus();

    return () => stopPolling();
  }, [refreshSyncStatus, startPolling, startupDeadlineRef, stopPolling]);
}

function useSyncStatusValue(
  state: SyncStatusState,
  triggerSyncStatusPolling: () => void
): SyncStatusContextValue {
  return useMemo(
    () => ({
      isLoading: state.isLoading,
      isPolling: state.isPolling,
      lastFetchFailed: state.lastFetchFailed,
      status: state.status,
      triggerSyncStatusPolling
    }),
    [state, triggerSyncStatusPolling]
  );
}

function useSyncStatusController(): SyncStatusContextValue {
  const state = useSyncStatusState();
  const { clearPollingInterval, intervalRef } = usePollingRef();
  const startupDeadlineRef = useRef<number | null>(null);
  const stopPolling = useStopPolling(state, clearPollingInterval);
  const refreshSyncStatus = useRefreshSyncStatus(state, startupDeadlineRef, stopPolling);
  const startPolling = useStartPolling(state, intervalRef, refreshSyncStatus);
  const triggerPolling = useTriggerSyncStatusPolling(intervalRef, refreshSyncStatus, startPolling);

  useInitialSyncStatusRefresh(refreshSyncStatus, startPolling, startupDeadlineRef, stopPolling);
  return useSyncStatusValue(state, triggerPolling);
}

/**
 * Provides sync status polling state to visual indicators.
 *
 * @example <SyncStatusProvider><AppShell /></SyncStatusProvider>
 */
export function SyncStatusProvider({ children }: PropsWithChildren) {
  const value = useSyncStatusController();

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

/**
 * Reads the current sync status context.
 *
 * @example const { status } = useSyncStatus()
 */
export function useSyncStatus() {
  const context = useContext(SyncStatusContext);

  if (!context) {
    throw new Error("Sync status context value is 'null'; expected useSyncStatus inside <SyncStatusProvider>.");
  }

  return context;
}
