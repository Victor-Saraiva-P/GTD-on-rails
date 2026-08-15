import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { ApiRequestError, DATABASE_UNAVAILABLE_EVENT } from "../../lib/api/apiClient";
import { fetchDatabaseReadiness } from "./api";
import { parseReadinessResponse, shouldReloadAfterDatabaseRecovery, type DatabaseReadinessStatus } from "./databaseReadiness";

const READINESS_POLL_INTERVAL_MS = 2000;

export type DatabaseReadinessContextValue = {
  isReady: boolean;
  status: DatabaseReadinessStatus;
};

const DatabaseReadinessContext = createContext<DatabaseReadinessContextValue | null>(null);

function useDatabaseReadinessState() {
  const [status, setStatus] = useState<DatabaseReadinessStatus>("ready");
  const wasBlocked = useRef(false);

  const markUnavailable = useCallback((newStatus: DatabaseReadinessStatus = "unavailable") => {
    wasBlocked.current = true;
    setStatus(newStatus);
  }, []);

  const refreshReadiness = useCallback(async () => {
    try {
      await fetchDatabaseReadiness();
      setStatus("ready");
      if (shouldReloadAfterDatabaseRecovery(wasBlocked.current, true)) window.location.reload();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        markUnavailable(parseReadinessResponse(error.responseBody));
        return;
      }
      markUnavailable("unavailable");
    }
  }, [markUnavailable]);

  return { isReady: status === "ready", status, markUnavailable, refreshReadiness };
}

function useReadinessPolling(refreshReadiness: () => Promise<void>) {
  useEffect(() => {
    const interval = window.setInterval(() => void refreshReadiness(), READINESS_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshReadiness]);
}

function useUnavailableRequestListener(markUnavailable: (status?: DatabaseReadinessStatus) => void) {
  useEffect(() => {
    const listener = () => markUnavailable("unavailable");
    window.addEventListener(DATABASE_UNAVAILABLE_EVENT, listener);
    return () => window.removeEventListener(DATABASE_UNAVAILABLE_EVENT, listener);
  }, [markUnavailable]);
}

function useDatabaseReadinessValue(): DatabaseReadinessContextValue {
  const { isReady, status, markUnavailable, refreshReadiness } = useDatabaseReadinessState();
  useReadinessPolling(refreshReadiness);
  useUnavailableRequestListener(markUnavailable);
  return { isReady, status };
}

/** Provides global PostgreSQL availability and authoritative recovery behavior.
 *
 * @example <DatabaseReadinessProvider><AppShell /></DatabaseReadinessProvider>
 */
export function DatabaseReadinessProvider({ children }: PropsWithChildren) {
  return <DatabaseReadinessContext.Provider value={useDatabaseReadinessValue()}>{children}</DatabaseReadinessContext.Provider>;
}

/** Reads whether the desktop can safely interact with PostgreSQL-backed state.
 *
 * @example const { isReady, status } = useDatabaseReadiness()
 */
export function useDatabaseReadiness(): DatabaseReadinessContextValue {
  const context = useContext(DatabaseReadinessContext);
  if (context) return context;
  throw new Error("database readiness context value is 'null'; expected useDatabaseReadiness inside <DatabaseReadinessProvider>.");
}
