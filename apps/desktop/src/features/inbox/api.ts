import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import type { Stuff, Body } from "./types";

type InboxStuffResponse = {
  id: string;
  title: string;
  body: Body | null;
  status: string;
  createdAt: string;
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
 * @example await createStuff("Capture idea", null)
 */
export async function createStuff(title: string, body: Body | null = null): Promise<Stuff> {
  const response = await apiJson<InboxStuffResponse>("/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      body
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
 * @example await updateStuffBody(stuff, "Next action")
 */
export async function updateStuffBody(item: Stuff, body: Body | null): Promise<Stuff> {
  return updateStuff(item, {
    title: item.title,
    body
  });
}

async function updateStuff(
  item: Stuff,
  payload: {
    title: string;
    body: Body | null;
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
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    status: item.status,
    createdAt: item.createdAt
  };
}
