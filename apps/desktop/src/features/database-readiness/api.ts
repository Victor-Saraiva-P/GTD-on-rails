import { apiFetch } from "../../lib/api/apiClient.ts";

const READINESS_REQUEST_TIMEOUT_MS = 2000;

/** Verifies that PostgreSQL can serve the full application state.
 *
 * @example await fetchDatabaseReadiness()
 */
export async function fetchDatabaseReadiness(): Promise<void> {
  await apiFetch("/readiness", { signal: AbortSignal.timeout(READINESS_REQUEST_TIMEOUT_MS) });
}
