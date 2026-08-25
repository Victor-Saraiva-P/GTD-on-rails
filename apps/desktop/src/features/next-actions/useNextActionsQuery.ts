import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient.ts";
import { optimisticMutate } from "../../lib/api/optimistic.ts";
import { useSyncStatus } from "../sync-status/SyncStatusProvider.tsx";
import type { ItemBody } from "../inbox/types";
import type { NextAction, NextActionOrder, NextActionPatch } from "./types";
import {
  deleteNextAction,
  fetchNextActions,
  markNextActionDone,
  markNextActionOnGoing,
  patchNextActionAttributes,
  resetNextActionStatus,
  restoreNextAction,
  updateNextActionBody,
  updateNextActionTitle
} from "./api";

type NextActionsQuery = ReturnType<typeof useNextActionsQuery>;
type LoadState = ReturnType<typeof useNextActionsLoadState>;
type MutationState = ReturnType<typeof useNextActionsMutationState>;

export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return `Failed to load next actions (${error.status})`;
  if (error instanceof Error) return error.message;
  return "Failed to load next actions";
}

export function useNextActionsLoadState() {
  const [items, setItems] = useState<NextAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return { errorMessage, isLoading, items, reloadToken, setErrorMessage, setIsLoading, setItems, setReloadToken };
}

export type NextActionsLoadState = ReturnType<typeof useNextActionsLoadState>;

export function useNextActionsMutationState() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  return { isDeleting, isUpdating, setIsDeleting, setIsUpdating };
}

export type NextActionsMutationState = ReturnType<typeof useNextActionsMutationState>;

async function loadNextActions(
  state: NextActionsLoadState,
  contextIds: string[],
  currentTimeMinutes: number | null,
  currentEnergy: number | null,
  orderBy: NextActionOrder,
  cancelled: () => boolean
) {
  state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    const nextItems = await fetchNextActions({ contextIds, currentEnergy, currentTimeMinutes, orderBy });
    if (!cancelled()) state.setItems(nextItems);
  } catch (error) {
    if (!cancelled()) state.setErrorMessage(toErrorMessage(error));
  } finally {
    if (!cancelled()) state.setIsLoading(false);
  }
}

export function useNextActionsLoader(
  state: NextActionsLoadState,
  contextIds: string[],
  currentTimeMinutes: number | null,
  currentEnergy: number | null,
  orderBy: NextActionOrder
) {
  useEffect(() => {
    let cancelled = false;
    void loadNextActions(state, contextIds, currentTimeMinutes, currentEnergy, orderBy, () => cancelled);
    return () => { cancelled = true; };
  }, [contextIds, currentEnergy, currentTimeMinutes, orderBy, state.reloadToken]);
}

function replaceItem(items: NextAction[], updated: NextAction): NextAction[] {
  return items.map((item) => (item.id === updated.id ? updated : item));
}

function completeMutation(state: NextActionsLoadState, poll: () => void) {
  state.setErrorMessage(null);
  poll();
}

export function useNextActionsMutations(state: NextActionsLoadState, mutations: NextActionsMutationState, reload: () => void) {
  const { triggerSyncStatusPolling } = useSyncStatus();
  return {
    deleteItem: (id: string) => deleteItem(id, state, mutations, triggerSyncStatusPolling),
    markAsDone: (id: string) => markAsDone(id, state, mutations, triggerSyncStatusPolling),
    markAsOnGoing: (id: string) => markAsOnGoing(id, state, mutations, triggerSyncStatusPolling),
    patchItem: (id: string, patch: NextActionPatch) => patchItem(id, patch, state, mutations, triggerSyncStatusPolling),
    restoreStatus: (id: string) => restoreStatus(id, state, mutations, triggerSyncStatusPolling),
    restoreItem: (id: string) => restoreItem(id, mutations, reload, triggerSyncStatusPolling),
    updateBody: (item: NextAction, body: ItemBody) => updateBody(item, body, state, mutations, triggerSyncStatusPolling),
    updateTitle: (item: NextAction, title: string) => updateTitle(item, title, state, mutations, triggerSyncStatusPolling)
  };
}

async function markAsDone(id: string, state: NextActionsLoadState, mutations: NextActionsMutationState, poll: () => void) {
  mutations.setIsUpdating(true);
  try {
    await optimisticMutate({
      current: () => state.items,
      applyOptimistic: (items) => items.filter((item) => item.id !== id),
      set: state.setItems,
      mutate: () => markNextActionDone(id),
      onError: (err) => state.setErrorMessage(toErrorMessage(err))
    });
    completeMutation(state, poll);
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function markAsOnGoing(id: string, state: NextActionsLoadState, mutations: NextActionsMutationState, poll: () => void) {
  mutations.setIsUpdating(true);
  try {
    await optimisticMutate({
      current: () => state.items,
      applyOptimistic: (items) => items.filter((item) => item.id !== id),
      set: state.setItems,
      mutate: () => markNextActionOnGoing(id),
      onError: (err) => state.setErrorMessage(toErrorMessage(err))
    });
    completeMutation(state, poll);
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function restoreStatus(id: string, state: NextActionsLoadState, mutations: NextActionsMutationState, poll: () => void) {
  mutations.setIsUpdating(true);
  try {
    await optimisticMutate({
      current: () => state.items,
      applyOptimistic: (items) => items.filter((item) => item.id !== id),
      set: state.setItems,
      mutate: () => resetNextActionStatus(id),
      onError: (err) => state.setErrorMessage(toErrorMessage(err))
    });
    completeMutation(state, poll);
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function deleteItem(id: string, state: NextActionsLoadState, mutations: NextActionsMutationState, poll: () => void) {
  mutations.setIsDeleting(true);
  try {
    await optimisticMutate({
      current: () => state.items,
      applyOptimistic: (items) => items.filter((item) => item.id !== id),
      set: state.setItems,
      mutate: () => deleteNextAction(id),
      onError: (err) => state.setErrorMessage(toErrorMessage(err))
    });
    completeMutation(state, poll);
  } finally {
    mutations.setIsDeleting(false);
  }
}

async function restoreItem(id: string, mutations: NextActionsMutationState, reload: () => void, poll: () => void) {
  mutations.setIsUpdating(true);
  try {
    await restoreNextAction(id);
    reload();
    poll();
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function patchItem(id: string, patch: NextActionPatch, state: NextActionsLoadState, mutations: NextActionsMutationState, poll: () => void) {
  mutations.setIsUpdating(true);
  try {
    const updated = await patchNextActionAttributes(id, patch);
    state.setItems((items) => replaceItem(items, updated));
    completeMutation(state, poll);
    return updated;
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function updateBody(item: NextAction, body: ItemBody, state: NextActionsLoadState, mutations: NextActionsMutationState, poll: () => void) {
  mutations.setIsUpdating(true);
  try {
    const updated = await updateNextActionBody(item, body);
    state.setItems((items) => replaceItem(items, updated));
    completeMutation(state, poll);
    return updated;
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function updateTitle(item: NextAction, title: string, state: NextActionsLoadState, mutations: NextActionsMutationState, poll: () => void) {
  mutations.setIsUpdating(true);
  try {
    const updated = await updateNextActionTitle(item, title);
    state.setItems((items) => replaceItem(items, updated));
    completeMutation(state, poll);
    return updated;
  } finally {
    mutations.setIsUpdating(false);
  }
}

/**
 * Loads next actions for the active filter and exposes item mutations.
 *
 * @example const query = useNextActionsQuery([], null, null, "energy")
 */
export function useNextActionsQuery(
  contextIds: string[],
  currentTimeMinutes: number | null,
  currentEnergy: number | null,
  orderBy: NextActionOrder
) {
  const state = useNextActionsLoadState();
  const mutations = useNextActionsMutationState();
  const reload = () => state.setReloadToken((value) => value + 1);
  const actions = useNextActionsMutations(state, mutations, reload);
  useNextActionsLoader(state, contextIds, currentTimeMinutes, currentEnergy, orderBy);
  return { ...actions, errorMessage: state.errorMessage, isDeleting: mutations.isDeleting, isLoading: state.isLoading, isUpdating: mutations.isUpdating, items: state.items, reload };
}

export type NextActionsQueryState = NextActionsQuery;
