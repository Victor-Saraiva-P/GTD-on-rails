import type { Project } from "./types";

/**
 * Filters active projects matching query substring case-insensitively.
 *
 * @example filterActiveProjects(projects, "launch")
 */
export function filterActiveProjects(projects: readonly Project[], query: string): Project[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...projects];
  return projects.filter((project) => project.title.toLowerCase().includes(normalized));
}

/**
 * Computes initial focused index targeting current project or 0.
 *
 * @example initialProjectIndex(projects, "Launch")
 */
export function initialProjectIndex(projects: readonly Project[], currentProjectTitle: string | null | undefined): number {
  if (!currentProjectTitle) return 0;
  const matchIndex = projects.findIndex((project) => project.title === currentProjectTitle);
  return matchIndex >= 0 ? matchIndex : 0;
}

/**
 * Clamps next index given keyboard delta and maximum option count.
 *
 * @example nextFocusedProjectIndex(0, 1, 5)
 */
export function nextFocusedProjectIndex(currentIndex: number, delta: number, maxCount: number): number {
  if (maxCount <= 0) return 0;
  return Math.min(Math.max(currentIndex + delta, 0), maxCount - 1);
}

export type ProjectAssociateSelectionOutcome =
  | { selected: true; projectId: string | null }
  | { selected: false };

/**
 * Resolves project id to associate or null to unassign based on focused index.
 *
 * @example resolveProjectAssociateSelection(0, [{ id: "p1", title: "P1" }], false)
 */
export function resolveProjectAssociateSelection(
  focusedIndex: number,
  filteredProjects: readonly Project[],
  hasCurrentProject: boolean
): ProjectAssociateSelectionOutcome {
  if (hasCurrentProject && focusedIndex === filteredProjects.length) {
    return { selected: true, projectId: null };
  }
  const target = filteredProjects[focusedIndex];
  if (target) {
    return { selected: true, projectId: target.id };
  }
  return { selected: false };
}

/**
 * Resolves CSS class name for a project associate dialog list item.
 *
 * @example resolveProjectItemClass(true, false)
 */
export function resolveProjectItemClass(isFocused: boolean, isCurrent: boolean): string {
  const classes = ["processing-dialog__list-item"];
  if (isFocused) classes.push("processing-dialog__list-item--focused");
  if (isCurrent) classes.push("processing-dialog__list-item--checked");
  return classes.join(" ");
}
