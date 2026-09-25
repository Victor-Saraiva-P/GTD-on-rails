import { getSharedEntitySnapshot, isSharedEntityPending, upsertSharedEntity } from "../../lib/state/sharedEntityStore.ts";
import { fetchItemBody } from "./api.ts";
import type { ItemBody, Stuff } from "./types.ts";

/**
 * Loads an item's body only when needed by a detail/editor surface.
 */
export async function ensureItemBodyLoaded(item: Stuff): Promise<ItemBody> {
  if (item.bodyLoaded !== false) return item.body;
  const body = await fetchItemBody(item.id);
  upsertSharedEntity({ id: item.id, body, bodyLoaded: true });
  return body;
}

/**
 * Refreshes only bodies already resident in memory after a remote body-document event.
 */
export async function refreshLoadedItemBody(id: string): Promise<void> {
  const item = getSharedEntitySnapshot<Stuff>(id);
  if (!item || item.bodyLoaded !== true || isSharedEntityPending(id)) return;
  const body = await fetchItemBody(id, true);
  upsertSharedEntity({ id, body, bodyLoaded: true });
}
