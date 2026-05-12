import { apiJson } from "../../lib/api/apiClient.ts";
import { deleteStuff, restoreStuff, updateStuffBody, updateStuffTitle } from "../inbox/api.ts";
import type { ItemBody } from "../inbox/types";
import type { NextAction, NextActionOrder, NextActionPatch, NextActionResponse } from "./types";
import { normalizeNextActionBody, parseEstimatedTime } from "./types.ts";

type NextActionsFetchParams = {
  contextId: string | null;
  orderBy: NextActionOrder;
};

/**
 * Loads next actions, optionally filtered by context and always ordered.
 *
 * @example await fetchNextActions({ contextId: null, orderBy: "energy" })
 */
export async function fetchNextActions(params: NextActionsFetchParams): Promise<NextAction[]> {
  const searchParams = new URLSearchParams({ orderBy: params.orderBy });
  if (params.contextId) searchParams.set("contextId", params.contextId);
  const response = await apiJson<NextActionResponse[]>(`/next-actions?${searchParams.toString()}`);
  return response.map(toNextAction);
}

/**
 * Updates next action attributes without changing title or body.
 *
 * @example await patchNextActionAttributes(id, { energy: 5 })
 */
export async function patchNextActionAttributes(id: string, patch: NextActionPatch): Promise<NextAction> {
  const response = await apiJson<NextActionResponse>(`/next-actions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  return toNextAction(response);
}

export { deleteStuff as deleteNextAction, restoreStuff as restoreNextAction };

export function updateNextActionBody(item: NextAction, body: ItemBody): Promise<NextAction> {
  return updateStuffBody(item, body) as Promise<NextAction>;
}

export function updateNextActionTitle(item: NextAction, title: string): Promise<NextAction> {
  return updateStuffTitle(item, title) as Promise<NextAction>;
}

function toNextAction(item: NextActionResponse): NextAction {
  return {
    id: item.id,
    title: item.title,
    body: normalizeNextActionBody(item.body),
    energy: item.energy == null ? null : Number(item.energy),
    estimatedTime: parseEstimatedTime(item.estimatedTime),
    contexts: item.contexts ?? [],
    status: item.status,
    schedule: item.schedule
  };
}
