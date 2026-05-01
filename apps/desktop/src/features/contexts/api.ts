import { apiFetch, apiJson } from "../../lib/api/apiClient";
import type { ContextItem, ContextRelatedItem } from "./types";

type ContextResponse = {
  id: string;
  name: string;
  iconUrl?: string;
};

type ContextRelatedItemResponse = {
  id: string;
  title: string;
  status: string;
};

/**
 * Loads every context available to the current desktop session.
 *
 * @example await fetchContexts()
 */
export async function fetchContexts(): Promise<ContextItem[]> {
  const response = await apiJson<ContextResponse[]>("/contexts");
  const iconRevision = Date.now();

  return response.map((context) => toContextItem(context, iconRevision));
}

/**
 * Creates a context with the normalized name supplied by the UI.
 *
 * @example await createContext("home")
 */
export async function createContext(name: string): Promise<ContextItem> {
  const response = await apiJson<ContextResponse>("/contexts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name
    })
  });

  return toContextItem(response);
}

/**
 * Updates a context name while preserving the rest of the context record.
 *
 * @example await updateContextName(context.id, "office")
 */
export async function updateContextName(id: string, name: string): Promise<ContextItem> {
  const response = await apiJson<ContextResponse>(`/contexts/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name
    })
  });

  return toContextItem(response);
}

/**
 * Deletes a context by identifier.
 *
 * @example await deleteContext(context.id)
 */
export async function deleteContext(id: string): Promise<void> {
  await apiFetch(`/contexts/${id}`, {
    method: "DELETE"
  });
}

/**
 * Uploads a replacement icon file for a context.
 *
 * @example await updateContextIcon(context.id, file)
 */
export async function updateContextIcon(id: string, file: File): Promise<ContextItem> {
  const body = new FormData();
  body.append("file", file);

  const response = await apiJson<ContextResponse>(`/contexts/${id}/icon`, {
    method: "PUT",
    body
  });

  return toContextItem(response);
}

/**
 * Removes the custom icon from a context.
 *
 * @example await deleteContextIcon(context.id)
 */
export async function deleteContextIcon(id: string): Promise<ContextItem> {
  const response = await apiJson<ContextResponse>(`/contexts/${id}/icon`, {
    method: "DELETE"
  });

  return toContextItem(response);
}

/**
 * Loads a bounded list of items related to a context.
 *
 * @example await fetchContextItems(context.id, 10)
 */
export async function fetchContextItems(id: string, limit: number): Promise<ContextRelatedItem[]> {
  const searchParams = new URLSearchParams({
    limit: String(limit)
  });
  const response = await apiJson<ContextRelatedItemResponse[]>(
    `/contexts/${id}/items?${searchParams.toString()}`
  );

  return response.map(toContextRelatedItem);
}

function toContextItem(context: ContextResponse, iconRevision = Date.now()): ContextItem {
  return {
    id: context.id,
    name: context.name,
    iconUrl: context.iconUrl,
    iconRevision: context.iconUrl ? iconRevision : undefined
  };
}

function toContextRelatedItem(item: ContextRelatedItemResponse): ContextRelatedItem {
  return {
    id: item.id,
    title: item.title,
    status: item.status
  };
}
