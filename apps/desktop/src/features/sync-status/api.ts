import { apiJson } from "../../lib/api/apiClient.ts";
import type { SyncStatus } from "./types";

/**
 * Loads the latest data and Google Calendar sync status snapshot.
 *
 * @example await fetchSyncStatus()
 */
export async function fetchSyncStatus(): Promise<SyncStatus> {
  return apiJson<SyncStatus>("/sync/status");
}
