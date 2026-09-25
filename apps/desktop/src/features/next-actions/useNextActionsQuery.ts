import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient.ts";
import { useSharedCollectionState } from "../../lib/state/sharedEntityStore.ts";
import { optimisticMutate } from "../../lib/api/optimistic.ts";
import { mutateSharedEntityOptimistically } from "../../lib/state/optimisticSharedEntity.ts";
import { useSyncStatus } from "../sync-status/SyncStatusProvider.tsx";
import { useDomainRevalidation } from "../sync-status/domainChanges.ts";
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
import { assignItemProject } from "../projects/api";

type NextActionsQuery = ReturnType<typeof useNextActionsQuery>;
export type NextActionsLoadState = ReturnType<typeof useNextActionsLoadState>;
export type NextActionsMutationState = ReturnType<typeof useNextActionsMutationState>;

/**
 * Normalizes an API or runtime error into a user-facing error message string.
 *
 * @example const msg = toErrorMessage(error);
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return `Failed to load next actions (${error.status})`;
  if (error instanceof Error) return error.message;
  return "Failed to load next actions";
}

function useNextActionsLoadState(collectionKey: string) {
  const collection = useSharedCollectionState<NextAction>(collectionKey);
  const [isLoading, setIsLoading] = useState(!collection.loaded);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return {
    errorMessage,
    hasSnapshot: collection.loaded,
    isLoading,
    items: collection.items,
    reloadToken,
    setErrorMessage,
    setIsLoading,
    setItems: collection.setItems,
    setReloadToken
  };
}

/**
 * Manages deleting and updating loading states for next action mutations.
 *
 * @example const mutations = useNextActionsMutationState();
 */
export function useNextActionsMutationState() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  return { isDeleting, isUpdating, setIsDeleting, setIsUpdating };
}

async function loadNextActions(
  state: NextActionsLoadState,
  contextIds: string[],
  currentTimeMinutes: number | null,
  currentEnergy: number | null,
  orderBy: NextActionOrder,
  cancelled: () => boolean
) {
  if (!state.hasSnapshot) state.setIsLoading(true);
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

function useNextActionsLoader(
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

async function optimisticRemoveAction(
  id: string,
  state: NextActionsLoadState,
  poll: () => void,
  action: (id: string) => Promise<unknown>,
  setBusy: (busy: boolean) => void
) {
  setBusy(true);
  try {
    await optimisticMutate({
      current: () => state.items,
      applyOptimistic: (items) => items.filter((item) => item.id !== id),
      set: state.setItems,
      mutate: () => action(id),
      onError: (err) => state.setErrorMessage(toErrorMessage(err))
    });
    completeMutation(state, poll);
  } finally {
    setBusy(false);
  }
}

/**
 * Binds mutation actions with optimistic updates for next action items.
 *
 * @example const actions = useNextActionsMutations(state, mutations, reload);
 */
export function useNextActionsMutations(state: NextActionsLoadState, mutations: NextActionsMutationState, reload: () => void) {
  const { triggerSyncStatusPolling } = useSyncStatus();
  return {
    deleteItem: (id: string) => optimisticRemoveAction(id, state, triggerSyncStatusPolling, deleteNextAction, mutations.setIsDeleting),
    markAsDone: (id: string) => optimisticRemoveAction(id, state, triggerSyncStatusPolling, markNextActionDone, mutations.setIsUpdating),
    markAsOnGoing: (id: string) => optimisticRemoveAction(id, state, triggerSyncStatusPolling, markNextActionOnGoing, mutations.setIsUpdating),
    patchItem: (id: string, patch: NextActionPatch) => patchItem(id, patch, state, triggerSyncStatusPolling),
    restoreStatus: (id: string) => optimisticRemoveAction(id, state, triggerSyncStatusPolling, resetNextActionStatus, mutations.setIsUpdating),
    restoreItem: (id: string) => restoreItem(id, mutations, reload, triggerSyncStatusPolling),
    updateBody: (item: NextAction, body: ItemBody) => updateBody(item, body, state, triggerSyncStatusPolling),
    updateTitle: (item: NextAction, title: string) => updateTitle(item, title, state, triggerSyncStatusPolling),
    assignProject: (item: NextAction, projectId: string | null) => assignProjectAction(item, projectId, state, triggerSyncStatusPolling)
  };
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

async function patchItem(id: string, patch: NextActionPatch, state: NextActionsLoadState, poll: () => void) {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) return patchNextActionAttributes(id, patch);

  const optimistic: NextAction = {
    ...item,
    ...(patch.energy !== undefined ? { energy: patch.energy } : {}),
    ...(patch.estimatedTime !== undefined ? { estimatedTime: patch.estimatedTime } : {}),
    ...(patch.clearDeadline ? { deadline: null } : patch.deadline !== undefined ? { deadline: patch.deadline } : {})
  };
  const updated = await mutateSharedEntityOptimistically(
    item,
    optimistic,
    () => patchNextActionAttributes(id, patch)
  );
  completeMutation(state, poll);
  return updated;
}

async function updateBody(item: NextAction, body: ItemBody, state: NextActionsLoadState, poll: () => void) {
  const updated = await mutateSharedEntityOptimistically(
    item,
    { ...item, body },
    () => updateNextActionBody(item, body)
  );
  completeMutation(state, poll);
  return updated;
}

async function updateTitle(item: NextAction, title: string, state: NextActionsLoadState, poll: () => void) {
  const updated = await mutateSharedEntityOptimistically(
    item,
    { ...item, title },
    () => updateNextActionTitle(item, title)
  );
  completeMutation(state, poll);
  return updated;
}

async function assignProjectAction(
  item: NextAction,
  projectId: string | null,
  state: NextActionsLoadState,
  poll: () => void
): Promise<NextAction> {
  const updated = await mutateSharedEntityOptimistically(
    item,
    { ...item, projectId },
    async () => {
      const result = await assignItemProject(item.id, projectId);
      return { ...item, projectId: result.projectId ?? projectId, projectTitle: result.projectTitle ?? null };
    }
  );
  completeMutation(state, poll);
  return updated;
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
  const collectionKey = nextActionsCollectionKey(contextIds, currentTimeMinutes, currentEnergy, orderBy);
  const state = useNextActionsLoadState(collectionKey);
  const mutations = useNextActionsMutationState();
  const reload = () => state.setReloadToken((value) => value + 1);
  const actions = useNextActionsMutations(state, mutations, reload);
  useNextActionsLoader(state, contextIds, currentTimeMinutes, currentEnergy, orderBy);
  useDomainRevalidation(["items", "next_actions", "body_document", "project_items"], reload);
  return { ...actions, errorMessage: state.errorMessage, isDeleting: mutations.isDeleting, isLoading: state.isLoading, isUpdating: mutations.isUpdating, items: state.items, reload };
}

function nextActionsCollectionKey(
  contextIds: string[],
  currentTimeMinutes: number | null,
  currentEnergy: number | null,
  orderBy: NextActionOrder
): string {
  const contexts = [...contextIds].sort().join(",");
  return `next-actions:${orderBy}:${currentEnergy ?? "any"}:${currentTimeMinutes ?? "any"}:${contexts}`;
}

export type NextActionsQueryState = NextActionsQuery;
