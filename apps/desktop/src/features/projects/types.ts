export type Project = {
  id: string;
  title: string;
  deadline?: string | null;
  doneDate?: string | null;
  doneTime?: string | null;
  actionCount?: number;
};

export type ProjectPatch = {
  title?: string;
  deadline?: string | null;
  clearDeadline?: boolean;
};

/**
 * Formats a project deadline for card metadata.
 *
 * @example formatProjectDeadline("2028-02-29")
 */
export function formatProjectDeadline(deadline?: string | null): string | null {
  if (!deadline) return null;
  const date = new Date(`${deadline}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

/**
 * Formats an action count for project card or detail metadata.
 *
 * @example formatProjectActionCount(2)
 */
export function formatProjectActionCount(count: number): string {
  return `${count} ${count === 1 ? "action" : "actions"}`;
}

/**
 * Determines if an active project is dead / stalled due to having 0 actions.
 *
 * @example isProjectDead({ id: "1", title: "Plan", actionCount: 0 }, "active")
 */
export function isProjectDead(project: Project, subview: string = "active"): boolean {
  if (subview !== "active" || Boolean(project.doneDate)) return false;
  return (project.actionCount ?? 0) === 0;
}
