import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import { deleteStuff, restoreStuff, updateStuffBody, updateStuffTitle } from "../inbox/api.ts";
import type { ItemBody } from "../inbox/types";
import type { NextAction, NextActionOrder, NextActionPatch, NextActionResponse } from "./types";
import { normalizeNextActionBody, parseEstimatedTime } from "./types.ts";

type NextActionsFetchParams = {
  contextId: string | null;
  orderBy: NextActionOrder;
};

type NextActionsPageResponse = {
  content: NextActionResponse[];
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
 * Loads on going next actions.
 *
 * @example await fetchOnGoingNextActions()
 */
export async function fetchOnGoingNextActions(): Promise<NextAction[]> {
  const response = await apiJson<NextActionResponse[]>("/next-actions/ongoing");
  return response.map(toNextAction);
}

/**
 * Moves a next action to the done state.
 *
 * @example await markNextActionDone(nextAction.id)
 */
export async function markNextActionDone(id: string): Promise<NextAction> {
  const response = await apiJson<NextActionResponse>(`/next-actions/${id}/done`, {
    method: "POST"
  });
  return toNextAction(response);
}

/**
 * Loads completed next actions from the API.
 *
 * @example await fetchDoneNextActions()
 */
export async function fetchDoneNextActions(): Promise<NextAction[]> {
  const response = await apiJson<NextActionsPageResponse>("/next-actions/done?page=0&size=100");
  return response.content.map(toNextAction);
}

/**
 * Loads deleted next actions from the API.
 *
 * @example await fetchDeletedNextActions()
 */
export async function fetchDeletedNextActions(): Promise<NextAction[]> {
  const response = await apiJson<NextActionResponse[]>("/next-actions/deleted");
  return response.map(toNextAction);
}

/**
 * Moves a next action to the on going state.
 *
 * @example await markNextActionOnGoing(nextAction.id)
 */
export async function markNextActionOnGoing(id: string): Promise<NextAction> {
  const response = await apiJson<NextActionResponse>(`/next-actions/${id}/ongoing`, {
    method: "POST"
  });
  return toNextAction(response);
}

/**
 * Moves a completed next action back to the active next action state.
 *
 * @example await markNextActionUndone(nextAction.id)
 */
export async function markNextActionUndone(id: string): Promise<NextAction> {
  const response = await apiJson<NextActionResponse>(`/next-actions/${id}/undone`, {
    method: "POST"
  });
  return toNextAction(response);
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

/**
 * Restores a soft-deleted next action item by identifier.
 *
 * @example await recoverDeletedNextAction(nextAction.id)
 */
export async function recoverDeletedNextAction(id: string): Promise<void> {
  await apiFetch(`/items/${id}/restore`, {
    method: "POST"
  });
}

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
