import type { Project } from "./types";

export type OwnerProjectCandidate = {
  projectId?: string | null;
  projectTitle?: string | null;
};

function matchByProjectId(projectId: string, projectTitle: string | null | undefined, projects: Project[]) {
  const matched = projects.find((p) => p.id === projectId);
  return { projectId, projectTitle: matched?.title ?? projectTitle ?? "Project" };
}

function matchByProjectTitle(projectTitle: string, projects: Project[]) {
  const matched = projects.find((p) => p.title.toLowerCase() === projectTitle.toLowerCase());
  return matched ? { projectId: matched.id, projectTitle: matched.title } : null;
}

/**
 * Resolves the owner project target from an item and known projects.
 *
 * @example resolveOwnerProject({ projectId: "p-1", projectTitle: "App" }, projects)
 */
export function resolveOwnerProject(
  item: OwnerProjectCandidate | null | undefined,
  projects: Project[] = []
): { projectId: string; projectTitle: string } | null {
  if (!item) return null;
  if (item.projectId) return matchByProjectId(item.projectId, item.projectTitle, projects);
  if (item.projectTitle) return matchByProjectTitle(item.projectTitle, projects);
  return null;
}

/**
 * Navigates to the owner project of an item if one is assigned.
 *
 * @example openOwnerProject(selectedItem, openProjectDetail, projects)
 */
export function openOwnerProject(
  item: OwnerProjectCandidate | null | undefined,
  openProjectDetail?: (projectId: string, projectTitle?: string | null) => void,
  projects: Project[] = []
): void {
  if (!openProjectDetail) return;
  const target = resolveOwnerProject(item, projects);
  if (target) {
    openProjectDetail(target.projectId, target.projectTitle);
  }
}
