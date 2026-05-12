import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import type { Stuff, ItemBody } from "./types";

type StuffResponse = {
  id: string;
  title: string;
  body: ItemBody | string | null;
  status: string;
  createdAt: string;
  energy?: number | null;
  estimatedTime?: { hours: number; minutes: number } | null;
  contexts?: Array<{ id: string; name: string }>;
};

type EstimatedTimePayload = {
  hours: number;
  minutes: number;
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
  const response = await apiJson<StuffResponse[]>("/inbox");

  return response.map(toStuff);
}

/**
 * Creates a new inbox stuff item with the provided title.
 *
 * @example await createStuff("Capture idea")
 */
export async function createStuff(title: string): Promise<Stuff> {
  const response = await apiJson<StuffResponse>("/inbox", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title
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
  const response = await apiJson<StuffResponse>(`/items/${item.id}/title`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title
    })
  });

  return toStuff(response);
}

/**
 * Updates the body of a stuff item while leaving its title unchanged.
 *
 * @example await updateStuffBody(stuff, { text: "Next action", inlineMarks: [], lineBlocks: [], blockEntities: [] })
 */
export async function updateStuffBody(item: Stuff, body: ItemBody): Promise<Stuff> {
  const response = await apiJson<StuffResponse>(`/items/${item.id}/body`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      body
    })
  });

  return toStuff(response);
}

/**
 * Converts a stuff item into a next action.
 *
 * @example await processStuff(stuff, 4.5, 90, ["context-id"])
 */
export async function processStuff(
  item: Stuff,
  energy: number | null,
  estimatedTimeMinutes: number | null,
  contextIds: string[]
): Promise<void> {
  const estimatedTime = buildEstimatedTimePayload(estimatedTimeMinutes);
  const payload = { energy: energy ?? 0, estimatedTime, contextIds };

  await apiFetch(`/inbox/${item.id}/next-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function buildEstimatedTimePayload(estimatedTimeMinutes: number | null): EstimatedTimePayload {
  const totalMinutes = Math.max(0, estimatedTimeMinutes ?? 0);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

function toStuff(item: StuffResponse): Stuff {
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
