import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import type { Stuff, ItemBody } from "./types";

type InboxStuffResponse = {
  id: string;
  title: string;
  body: ItemBody | string | null;
  energy?: number | null;
  estimatedTime?: { hours: number; minutes: number } | null;
  contexts?: Array<{ id: string; name: string }>;
  status: string;
  createdAt: string;
};

export type StuffAssetResponse = {
  id: string;
  relativePath: string;
  url?: string;
  fileName: string;
  contentType: string;
  image: boolean;
};

/**
 * Loads all inbox stuff from the API.
 *
 * @example await fetchInboxStuffs()
 */
export async function fetchInboxStuffs(): Promise<Stuff[]> {
  const response = await apiJson<InboxStuffResponse[]>("/inbox");

  return response.map(toStuff);
}

/**
 * Creates a new inbox stuff item with an optional body.
 *
 * @example await createStuff("Capture idea", { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] })
 */
export async function createStuff(title: string, body?: ItemBody): Promise<Stuff> {
  const actualBody = body ?? { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
  const response = await apiJson<InboxStuffResponse>("/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      body: actualBody
    })
  });

  return toStuff(response);
}

/**
 * Deletes an inbox stuff item by identifier.
 *
 * @example await deleteStuff(stuff.id)
 */
export async function deleteStuff(id: string): Promise<void> {
  await apiFetch(`/items/${id}`, {
    method: "DELETE"
  });
}

/**
 * Restores a soft-deleted inbox stuff item by identifier.
 *
 * @example await restoreStuff(stuff.id)
 */
export async function restoreStuff(id: string): Promise<void> {
  await apiFetch(`/items/${id}/restore`, {
    method: "POST"
  });
}

/**
 * Uploads a clipboard asset for one stuff item.
 *
 * @example await uploadStuffAsset(stuff.id, file)
 */
export async function uploadStuffAsset(id: string, file: File): Promise<StuffAssetResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return apiJson<StuffAssetResponse>(`/items/${id}/assets`, {
    method: "POST",
    body: formData
  });
}


/**
 * Updates a stuff title using its current record for optimistic shape context.
 *
 * @example await updateStuffTitle(stuff, "Updated title")
 */
export async function updateStuffTitle(item: Stuff, title: string): Promise<Stuff> {
  return updateStuff(item, {
    title,
    body: item.body
  });
}

/**
 * Updates the body of a stuff item while leaving its title unchanged.
 *
 * @example await updateStuffBody(stuff, { text: "Next action", inlineMarks: [], lineBlocks: [], blockEntities: [] })
 */
export async function updateStuffBody(item: Stuff, body: ItemBody): Promise<Stuff> {
  return updateStuff(item, {
    title: item.title,
    body
  });
}

/**
 * Updates a stuff's processing metadata (energy, estimated time, and contexts).
 *
 * @example await processStuff(stuff, 4.5, 90, ["context-id"])
 */
export async function processStuff(
  item: Stuff,
  energy: number | null,
  estimatedTimeMinutes: number | null,
  contextIds: string[]
): Promise<Stuff> {
  const estimatedTime = estimatedTimeMinutes !== null ? {
    hours: Math.floor(estimatedTimeMinutes / 60),
    minutes: estimatedTimeMinutes % 60
  } : null;
  const payload = { energy, estimatedTime, contextIds };

  const response = await apiJson<InboxStuffResponse>(`/items/${item.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return toStuff(response);
}

async function updateStuff(
  item: Stuff,
  payload: {
    title: string;
    body: ItemBody;
  }
): Promise<Stuff> {
  const response = await apiJson<InboxStuffResponse>(`/items/${item.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body
    })
  });

  return toStuff(response);
}

function toStuff(item: InboxStuffResponse): Stuff {
  let parsedBody: ItemBody;
  if (!item.body) {
    parsedBody = { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
  } else if (typeof item.body === "string") {
    parsedBody = { text: item.body, inlineMarks: [], lineBlocks: [], blockEntities: [] };
  } else {
    parsedBody = item.body;
  }

  return {
    id: item.id,
    title: item.title,
    body: parsedBody,
    energy: item.energy ?? null,
    estimatedTime: item.estimatedTime ?? null,
    contexts: item.contexts ?? [],
    status: item.status,
    createdAt: item.createdAt
  };
}
