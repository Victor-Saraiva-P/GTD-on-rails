import { apiFetch, apiJson } from "../../lib/api/apiClient";
import type { ContextItem } from "./types";

type ContextResponse = {
  id: string;
  name: string;
};

export async function fetchContexts(): Promise<ContextItem[]> {
  const response = await apiJson<ContextResponse[]>("/contexts");

  return response.map(toContextItem);
}

export async function createContext(): Promise<ContextItem> {
  const response = await apiJson<ContextResponse>("/contexts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "New context"
    })
  });

  return toContextItem(response);
}

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

export async function deleteContext(id: string): Promise<void> {
  await apiFetch(`/contexts/${id}`, {
    method: "DELETE"
  });
}

function toContextItem(context: ContextResponse): ContextItem {
  return {
    id: context.id,
    name: context.name
  };
}
