export type ProjectSubview = "active" | "completed" | "deleted";

export type ProjectSubviewDirection = "next" | "previous";

const projectSubviewOrder: ProjectSubview[] = ["active", "completed", "deleted"];

/**
 * Cycles Projects subviews in either keyboard direction.
 *
 * @example projectSubviewTarget("active")
 */
export function projectSubviewTarget(subview: ProjectSubview, direction: ProjectSubviewDirection): ProjectSubview {
  const index = projectSubviewOrder.indexOf(subview);
  const offset = direction === "next" ? 1 : -1;
  return projectSubviewOrder[(index + offset + projectSubviewOrder.length) % projectSubviewOrder.length];
}
