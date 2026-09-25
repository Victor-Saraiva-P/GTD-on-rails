import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import type { RebootstrapResult, SyncConflictChoice, SyncConflictDetail, SyncConflictSummary, SyncStatus } from "./types";

/**
 * Loads the latest data and Google Calendar sync status snapshot.
 *
 * @example await fetchSyncStatus()
 */
export async function fetchSyncStatus(): Promise<SyncStatus> {
  return apiJson<SyncStatus>("/sync/status");
}

export async function fetchSyncConflicts(): Promise<SyncConflictSummary[]> {
  return apiJson<SyncConflictSummary[]>("/sync/conflicts");
}

export async function fetchSyncConflict(id: number): Promise<SyncConflictDetail> {
  return apiJson<SyncConflictDetail>(`/sync/conflicts/${id}`);
}

export async function resolveSyncConflict(
  id: number,
  choice: SyncConflictChoice,
  mergedContent?: string
): Promise<void> {
  await apiFetch(`/sync/conflicts/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice, mergedContent: mergedContent ?? null })
  });
}

export async function rebootstrapSyncClient(): Promise<RebootstrapResult> {
  return apiJson<RebootstrapResult>("/sync/rebootstrap", { method: "POST" });
}
