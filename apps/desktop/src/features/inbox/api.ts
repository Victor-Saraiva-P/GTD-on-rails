import { apiJson } from "../../lib/api/apiClient";
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

  return response.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    status: item.status,
    contexts: item.contexts
  }));
}
