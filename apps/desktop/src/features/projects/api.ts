import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import type { Stuff } from "../inbox/types";
import type { Project, ProjectPatch } from "./types";

type ProjectResponse = {
  id: string;
  title: string;
  deadline?: string | null;
  doneDate?: string | null;
  doneTime?: string | null;
};

/**
 * Loads active projects from the API.
 *
 * @example await fetchProjects()
 */
export async function fetchProjects(): Promise<Project[]> {
  return (await apiJson<ProjectResponse[]>("/projects")).map(toProject);
}

/**
 * Loads completed projects from the API.
 *
 * @example await fetchDoneProjects()
 */
export async function fetchDoneProjects(): Promise<Project[]> {
  return (await apiJson<ProjectResponse[]>("/projects/done")).map(toProject);
}

/**
 * Loads deleted projects from the API.
 *
 * @example await fetchDeletedProjects()
 */
export async function fetchDeletedProjects(): Promise<Project[]> {
  return (await apiJson<ProjectResponse[]>("/projects/deleted")).map(toProject);
}

/**
 * Converts captured stuff into a project.
 *
 * @example await processStuffToProject(stuff, "2028-02-29")
 */
export async function processStuffToProject(item: Stuff, deadline: string | null): Promise<void> {
  await apiFetch(`/inbox/${item.id}/project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deadline })
  });
}

/**
 * Updates project title or deadline attributes.
 *
 * @example await patchProject(project.id, { clearDeadline: true })
 */
export async function patchProject(id: string, patch: ProjectPatch): Promise<Project> {
  return toProject(await apiJson<ProjectResponse>(`/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  }));
}

/**
 * Moves a project to the done state.
 *
 * @example await markProjectDone(project.id)
 */
export async function markProjectDone(id: string): Promise<Project> {
  return toProject(await apiJson<ProjectResponse>(`/projects/${id}/done`, { method: "POST" }));
}

/**
 * Restores a completed project to active commitments.
 *
 * @example await resetProjectStatus(project.id)
 */
export async function resetProjectStatus(id: string): Promise<Project> {
  return toProject(await apiJson<ProjectResponse>(`/projects/${id}/reset-status`, { method: "POST" }));
}

/**
 * Soft-deletes a project.
 *
 * @example await deleteProject(project.id)
 */
export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/projects/${id}`, { method: "DELETE" });
}

/**
 * Recovers a deleted project.
 *
 * @example await recoverProject(project.id)
 */
export async function recoverProject(id: string): Promise<Project> {
  return toProject(await apiJson<ProjectResponse>(`/projects/${id}/recover`, { method: "POST" }));
}

function toProject(response: ProjectResponse): Project {
  return { id: response.id, title: response.title, deadline: response.deadline ?? null, doneDate: response.doneDate ?? null, doneTime: response.doneTime ?? null };
}
