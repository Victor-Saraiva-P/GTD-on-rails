import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient.ts";
import { optimisticMutate } from "../../lib/api/optimistic.ts";
import { mutateSharedEntityOptimistically } from "../../lib/state/optimisticSharedEntity.ts";
import { useSharedCollectionState } from "../../lib/state/sharedEntityStore.ts";
import type { ItemBody } from "../inbox/types.ts";
import { useSyncStatus } from "../sync-status/SyncStatusProvider.tsx";
import { useDomainRevalidation } from "../sync-status/domainChanges.ts";
import {
  assignSomedayMaybeProject,
  deleteSomedayMaybeItem,
  fetchDeletedSomedayMaybeItems,
  fetchSomedayMaybeItems,
  restoreSomedayMaybeItem,
  revertSomedayMaybeToStuff,
  updateSomedayMaybeBody,
  updateSomedayMaybeTitle
} from "./api.ts";
import type { SomedayMaybeItem, SomedayMaybeSubview } from "./types.ts";

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return `Failed to load someday/maybe (${error.status})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load someday/maybe";
}

function replaceItem(items: SomedayMaybeItem[], updated: SomedayMaybeItem): SomedayMaybeItem[] {
  return items.map((item) => (item.id === updated.id ? updated : item));
}

function useSomedayMaybeLoadState(subview: SomedayMaybeSubview) {
  const collection = useSharedCollectionState<SomedayMaybeItem>(`someday-maybe:${subview}`);
  const [isLoading, setIsLoading] = useState(!collection.loaded);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  return {
    errorMessage,
    hasSnapshot: collection.loaded,
    isLoading,
    items: collection.items,
    reload: () => setReloadToken((token) => token + 1),
    reloadToken,
    setErrorMessage,
    setIsLoading,
    setItems: collection.setItems
  };
}

async function fetchItemsForSubview(subview: SomedayMaybeSubview): Promise<SomedayMaybeItem[]> {
  if (subview === "active") {
    return fetchSomedayMaybeItems();
  }
  return fetchDeletedSomedayMaybeItems();
}

async function loadSomedayMaybeItems(
  subview: SomedayMaybeSubview,
  isCancelled: () => boolean,
  state: ReturnType<typeof useSomedayMaybeLoadState>
) {
  if (!state.hasSnapshot) state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    const nextItems = await fetchItemsForSubview(subview);
    if (!isCancelled()) {
      state.setItems(nextItems);
    }
  } catch (error) {
    if (!isCancelled()) {
      state.setErrorMessage(toErrorMessage(error));
    }
  } finally {
    if (!isCancelled()) {
      state.setIsLoading(false);
    }
  }
}

async function mutateAndFilterItem(
  id: string,
  mutateAction: (id: string) => Promise<unknown>,
  state: ReturnType<typeof useSomedayMaybeLoadState>,
  setUpdating: (value: boolean) => void,
  poll: () => void
) {
  setUpdating(true);
  try {
    await optimisticMutate({
      current: () => state.items,
      applyOptimistic: (items) => items.filter((item) => item.id !== id),
      set: state.setItems,
      mutate: () => mutateAction(id),
      onError: (error) => state.setErrorMessage(toErrorMessage(error))
    });
    state.setErrorMessage(null);
    poll();
  } finally {
    setUpdating(false);
  }
}

async function updateAndReplaceItem(
  item: SomedayMaybeItem,
  optimistic: SomedayMaybeItem,
  updateAction: () => Promise<SomedayMaybeItem>,
  state: ReturnType<typeof useSomedayMaybeLoadState>,
  poll: () => void
): Promise<SomedayMaybeItem> {
  const updated = await mutateSharedEntityOptimistically(item, optimistic, updateAction);
  state.setErrorMessage(null);
  poll();
  return updated;
}

function buildSomedayMaybeMutations(
  state: ReturnType<typeof useSomedayMaybeLoadState>,
  setUpdating: (value: boolean) => void,
  poll: () => void
) {
  return {
    assignProject: (item: SomedayMaybeItem, projectId: string | null) =>
      updateAndReplaceItem(item, { ...item, projectId }, () => assignSomedayMaybeProject(item, projectId), state, poll),
    deleteItem: (id: string) => mutateAndFilterItem(id, deleteSomedayMaybeItem, state, setUpdating, poll),
    recoverItem: (id: string) => mutateAndFilterItem(id, restoreSomedayMaybeItem, state, setUpdating, poll),
    revertToStuff: (id: string) => mutateAndFilterItem(id, revertSomedayMaybeToStuff, state, setUpdating, poll),
    updateBody: (item: SomedayMaybeItem, body: ItemBody) =>
      updateAndReplaceItem(item, { ...item, body }, () => updateSomedayMaybeBody(item, body), state, poll),
    updateTitle: (item: SomedayMaybeItem, title: string) =>
      updateAndReplaceItem(item, { ...item, title }, () => updateSomedayMaybeTitle(item, title), state, poll)
  };
}

/**
 * Loads someday/maybe items for a subview and exposes update and delete mutations.
 *
 * @example const query = useSomedayMaybeQuery("active")
 */
export function useSomedayMaybeQuery(subview: SomedayMaybeSubview) {
  const state = useSomedayMaybeLoadState(subview);
  const [isUpdating, setIsUpdating] = useState(false);
  const { triggerSyncStatusPolling } = useSyncStatus();

  useDomainRevalidation(["items", "body_document", "project_items"], state.reload);

  useEffect(() => {
    let cancelled = false;
    void loadSomedayMaybeItems(subview, () => cancelled, state);
    return () => {
      cancelled = true;
    };
  }, [state.reloadToken, subview]);

  const mutations = buildSomedayMaybeMutations(state, setIsUpdating, triggerSyncStatusPolling);

  return {
    ...mutations,
    errorMessage: state.errorMessage,
    isLoading: state.isLoading,
    isUpdating,
    items: state.items,
    reload: state.reload,
    setItems: state.setItems
  };
}
