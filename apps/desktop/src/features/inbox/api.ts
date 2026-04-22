import { apiFetch, apiJson } from "../../lib/api/apiClient";
import type { Stuff } from "./types";

type InboxStuffResponse = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  contexts: Array<{
    id: string;
    name: string;
  }>;
};

export async function fetchInboxStuffs(): Promise<Stuff[]> {
  const response = await apiJson<InboxStuffResponse[]>("/inbox");

  return response.map(toStuff);
}

export async function createStuff(): Promise<Stuff> {
  const response = await apiJson<InboxStuffResponse>("/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: "New stuff",
      body: null,
      contextIds: []
    })
  });

  return toStuff(response);
}

export async function deleteStuff(id: string): Promise<void> {
  await apiFetch(`/items/${id}`, {
    method: "DELETE"
  });
}

export async function updateStuffTitle(item: Stuff, title: string): Promise<Stuff> {
  return updateStuff(item, {
    title,
    body: item.body
  });
}

export async function updateStuffBody(item: Stuff, body: string | null): Promise<Stuff> {
  return updateStuff(item, {
    title: item.title,
    body
  });
}

async function updateStuff(
  item: Stuff,
  payload: {
    title: string;
    body: string | null;
  }
): Promise<Stuff> {
  const response = await apiJson<InboxStuffResponse>(`/items/${item.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      contextIds: item.contexts.map((context) => context.id)
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
    contexts: item.contexts
  };
}
