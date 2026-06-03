import type { Stuff } from "./types";

/**
 * Removes an inbox item after the backend accepted processing into another GTD list.
 *
 * @example removeProcessedInboxStuff(stuffs, item.id)
 */
export function removeProcessedInboxStuff(currentStuffs: Stuff[], itemId: string): Stuff[] {
  return currentStuffs.filter((stuff) => stuff.id !== itemId);
}
