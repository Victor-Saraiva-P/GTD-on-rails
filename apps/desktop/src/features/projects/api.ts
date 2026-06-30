import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import type { Stuff } from "../inbox/types";
import type { Project, ProjectPatch } from "./types";

type ProjectResponse = {
  id: string;
  title: string;
  deadline?: string | null;
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

function toProject(response: ProjectResponse): Project {
  return { id: response.id, title: response.title, deadline: response.deadline ?? null };
}
