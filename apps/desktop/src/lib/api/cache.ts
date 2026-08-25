import { apiFetch } from "./apiClient.ts";

/**
 * Sends a request to evict all in-memory domain query caches on the backend.
 *
 * @example await evictBackendCache()
 */
export async function evictBackendCache(): Promise<void> {
  try {
    await apiFetch("/maintenance/cache/evict", { method: "POST" });
  } catch {
    // Non-blocking: fail gracefully if backend is offline or unreachable
  }
}
