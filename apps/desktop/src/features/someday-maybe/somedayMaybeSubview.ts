import type { SomedayMaybeSubview } from "./types.ts";

export type SomedayMaybeSubviewDirection = "next" | "previous";

/**
 * Calculates the target subview when cycling through someday/maybe views.
 *
 * @example somedayMaybeSubviewTarget("active", "next")
 */
export function somedayMaybeSubviewTarget(
  current: SomedayMaybeSubview,
  _direction: SomedayMaybeSubviewDirection
): SomedayMaybeSubview {
  return current === "active" ? "deleted" : "active";
}
