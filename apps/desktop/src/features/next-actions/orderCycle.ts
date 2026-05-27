import type { NextActionOrder } from "./types";

export const DEFAULT_NEXT_ACTION_ORDER: NextActionOrder = "priority";

/**
 * Returns the next ordering mode for the next-actions page.
 *
 * @example nextOrder("priority")
 */
export function nextOrder(order: NextActionOrder): NextActionOrder {
  if (order === "priority") return "time";
  if (order === "time") return "energy";
  return "priority";
}
