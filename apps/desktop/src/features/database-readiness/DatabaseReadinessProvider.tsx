import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { DATABASE_UNAVAILABLE_EVENT } from "../../lib/api/apiClient";
import { fetchDatabaseReadiness } from "./api";
import { shouldReloadAfterDatabaseRecovery } from "./databaseReadiness";

const READINESS_POLL_INTERVAL_MS = 2000;

type DatabaseReadinessContextValue = { isReady: boolean };

const DatabaseReadinessContext = createContext<DatabaseReadinessContextValue | null>(null);

function useDatabaseReadinessState() {
  const [isReady, setIsReady] = useState(true);
  const wasBlocked = useRef(false);

  const markUnavailable = useCallback(() => {
    wasBlocked.current = true;
    setIsReady(false);
  }, []);

  const refreshReadiness = useCallback(async () => {
    try {
      await fetchDatabaseReadiness();
      if (shouldReloadAfterDatabaseRecovery(wasBlocked.current, true)) window.location.reload();
    } catch {
      markUnavailable();
    }
  }, [markUnavailable]);

  return { isReady, markUnavailable, refreshReadiness };
}

function useReadinessPolling(refreshReadiness: () => Promise<void>) {
  useEffect(() => {
    const interval = window.setInterval(() => void refreshReadiness(), READINESS_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshReadiness]);
}

function useUnavailableRequestListener(markUnavailable: () => void) {
  useEffect(() => {
    window.addEventListener(DATABASE_UNAVAILABLE_EVENT, markUnavailable);
    return () => window.removeEventListener(DATABASE_UNAVAILABLE_EVENT, markUnavailable);
  }, [markUnavailable]);
}

function useDatabaseReadinessValue(): DatabaseReadinessContextValue {
  const { isReady, markUnavailable, refreshReadiness } = useDatabaseReadinessState();
  useReadinessPolling(refreshReadiness);
  useUnavailableRequestListener(markUnavailable);
  return { isReady };
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
 * @example const { isReady } = useDatabaseReadiness()
 */
export function useDatabaseReadiness(): DatabaseReadinessContextValue {
  const context = useContext(DatabaseReadinessContext);
  if (context) return context;
  throw new Error("database readiness context value is 'null'; expected useDatabaseReadiness inside <DatabaseReadinessProvider>.");
}
