import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import type { ItemBody } from "../inbox/types.ts";
import type { SomedayMaybeItem } from "./types.ts";

type SomedayMaybeResponse = {
  id: string;
  title: string;
  body: ItemBody | string | null;
  status: string;
  createdAt?: string;
  projectId?: string | null;
  projectTitle?: string | null;
};

function parseBody(body: ItemBody | string | null): ItemBody {
  if (!body) {
    return { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
  }
  if (typeof body === "string") {
    return { text: body, inlineMarks: [], lineBlocks: [], blockEntities: [] };
  }
  return body;
}

function toSomedayMaybeItem(item: SomedayMaybeResponse): SomedayMaybeItem {
  return {
    id: item.id,
    title: item.title,
    body: parseBody(item.body),
    bodyLoaded: item.body != null,
    status: "SOMEDAY_MAYBE",
    createdAt: item.createdAt,
    projectId: item.projectId ?? null,
    projectTitle: item.projectTitle ?? null
  };
}

/**
 * Loads all active someday/maybe items.
 *
 * @example const items = await fetchSomedayMaybeItems()
 */
export async function fetchSomedayMaybeItems(): Promise<SomedayMaybeItem[]> {
  const response = await apiJson<SomedayMaybeResponse[]>("/someday-maybe");
  return response.map(toSomedayMaybeItem);
}

/**
 * Loads all deleted someday/maybe items.
 *
 * @example const items = await fetchDeletedSomedayMaybeItems()
 */
export async function fetchDeletedSomedayMaybeItems(): Promise<SomedayMaybeItem[]> {
  const response = await apiJson<SomedayMaybeResponse[]>("/someday-maybe/deleted");
  return response.map(toSomedayMaybeItem);
}

/**
 * Reverts a someday/maybe item back to inbox stuff.
 *
 * @example await revertSomedayMaybeToStuff("item-id")
 */
export async function revertSomedayMaybeToStuff(id: string): Promise<void> {
  await apiFetch(`/someday-maybe/${id}/stuff`, {
    method: "POST"
  });
}

/**
 * Soft-deletes a someday/maybe item.
 *
 * @example await deleteSomedayMaybeItem("item-id")
 */
export async function deleteSomedayMaybeItem(id: string): Promise<void> {
  await apiFetch(`/items/${id}`, {
    method: "DELETE"
  });
}

/**
 * Restores a deleted someday/maybe item.
 *
 * @example await restoreSomedayMaybeItem("item-id")
 */
export async function restoreSomedayMaybeItem(id: string): Promise<void> {
  await apiFetch(`/items/${id}/restore`, {
    method: "POST"
  });
}

/**
 * Updates the title of a someday/maybe item.
 *
 * @example const updated = await updateSomedayMaybeTitle(item, "New title")
 */
export async function updateSomedayMaybeTitle(item: SomedayMaybeItem, title: string): Promise<SomedayMaybeItem> {
  const response = await apiJson<SomedayMaybeResponse>(`/items/${item.id}/title`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  return toSomedayMaybeItem(response);
}

/**
 * Updates the markdown body of a someday/maybe item.
 *
 * @example const updated = await updateSomedayMaybeBody(item, newBody)
 */
export async function updateSomedayMaybeBody(item: SomedayMaybeItem, body: ItemBody): Promise<SomedayMaybeItem> {
  const response = await apiJson<SomedayMaybeResponse>(`/items/${item.id}/body`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body })
  });
  return toSomedayMaybeItem(response);
}

/**
 * Assigns or unassigns a project to a someday/maybe item.
 *
 * @example const updated = await assignSomedayMaybeProject(item, "project-id")
 */
export async function assignSomedayMaybeProject(item: SomedayMaybeItem, projectId: string | null): Promise<SomedayMaybeItem> {
  const response = await apiJson<SomedayMaybeResponse>(`/items/${item.id}/project`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId })
  });
  return toSomedayMaybeItem(response);
}
