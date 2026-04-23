import { apiJson } from "../../lib/api/apiClient";
import type { SyncStatus } from "./types";

export async function fetchSyncStatus(): Promise<SyncStatus> {
  return apiJson<SyncStatus>("/sync/status");
}
