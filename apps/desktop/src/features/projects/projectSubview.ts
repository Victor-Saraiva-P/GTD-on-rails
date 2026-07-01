export type ProjectSubview = "active" | "completed";

/**
 * Cycles Projects subviews in either keyboard direction.
 *
 * @example projectSubviewTarget("active")
 */
export function projectSubviewTarget(subview: ProjectSubview): ProjectSubview {
  return subview === "active" ? "completed" : "active";
}
