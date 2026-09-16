import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient.ts";
import type { ItemBody } from "../inbox/types.ts";
import { useSyncStatus } from "../sync-status/SyncStatusProvider.tsx";
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

function useSomedayMaybeLoadState() {
  const [items, setItems] = useState<SomedayMaybeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  return {
    errorMessage,
    isLoading,
    items,
    reload: () => setReloadToken((token) => token + 1),
    reloadToken,
    setErrorMessage,
    setIsLoading,
    setItems
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
  state.setIsLoading(true);
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
    await mutateAction(id);
    state.setItems((items) => items.filter((item) => item.id !== id));
    poll();
  } finally {
    setUpdating(false);
  }
}

async function updateAndReplaceItem(
  updateAction: () => Promise<SomedayMaybeItem>,
  state: ReturnType<typeof useSomedayMaybeLoadState>,
  setUpdating: (value: boolean) => void,
  poll: () => void
): Promise<SomedayMaybeItem> {
  setUpdating(true);
  try {
    const updated = await updateAction();
    state.setItems((items) => replaceItem(items, updated));
    poll();
    return updated;
  } finally {
    setUpdating(false);
  }
}

function buildSomedayMaybeMutations(
  state: ReturnType<typeof useSomedayMaybeLoadState>,
  setUpdating: (value: boolean) => void,
  poll: () => void
) {
  return {
    assignProject: (item: SomedayMaybeItem, projectId: string | null) =>
      updateAndReplaceItem(() => assignSomedayMaybeProject(item, projectId), state, setUpdating, poll),
    deleteItem: (id: string) => mutateAndFilterItem(id, deleteSomedayMaybeItem, state, setUpdating, poll),
    recoverItem: (id: string) => mutateAndFilterItem(id, restoreSomedayMaybeItem, state, setUpdating, poll),
    revertToStuff: (id: string) => mutateAndFilterItem(id, revertSomedayMaybeToStuff, state, setUpdating, poll),
    updateBody: (item: SomedayMaybeItem, body: ItemBody) =>
      updateAndReplaceItem(() => updateSomedayMaybeBody(item, body), state, setUpdating, poll),
    updateTitle: (item: SomedayMaybeItem, title: string) =>
      updateAndReplaceItem(() => updateSomedayMaybeTitle(item, title), state, setUpdating, poll)
  };
}

/**
 * Loads someday/maybe items for a subview and exposes update and delete mutations.
 *
 * @example const query = useSomedayMaybeQuery("active")
 */
export function useSomedayMaybeQuery(subview: SomedayMaybeSubview) {
  const state = useSomedayMaybeLoadState();
  const [isUpdating, setIsUpdating] = useState(false);
  const { triggerSyncStatusPolling } = useSyncStatus();

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
