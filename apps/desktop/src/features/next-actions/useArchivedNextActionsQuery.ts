import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import type { NextAction } from "./types";

type ArchivedNextActionsQuery = ReturnType<typeof useArchivedNextActionsQuery>;
type ArchivedNextActionsLoadState = ReturnType<typeof useArchivedNextActionsLoadState>;
type ArchivedNextActionsMutationState = ReturnType<typeof useArchivedNextActionsMutationState>;

type ArchivedNextActionsQueryConfig = {
  loadItems: () => Promise<NextAction[]>;
  recoverItem: (id: string) => Promise<NextAction | void>;
  errorLabel: string;
};

function errorMessage(error: unknown, label: string): string {
  if (error instanceof ApiRequestError) return `Failed to load ${label} (${error.status})`;
  if (error instanceof Error) return error.message;
  return `Failed to load ${label}`;
}

function useArchivedNextActionsLoadState() {
  const [items, setItems] = useState<NextAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessageText, setErrorMessageText] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  return { errorMessageText, isLoading, items, reloadToken, setErrorMessageText, setIsLoading, setItems, setReloadToken };
}

function useArchivedNextActionsMutationState() {
  const [isUpdating, setIsUpdating] = useState(false);
  return { isUpdating, setIsUpdating };
}

async function loadArchivedItems(
  config: ArchivedNextActionsQueryConfig,
  state: ArchivedNextActionsLoadState,
  cancelled: () => boolean
) {
  state.setIsLoading(true);
  state.setErrorMessageText(null);

  try {
    const nextItems = await config.loadItems();
    if (!cancelled()) state.setItems(nextItems);
  } catch (error) {
    if (!cancelled()) state.setErrorMessageText(errorMessage(error, config.errorLabel));
  } finally {
    if (!cancelled()) state.setIsLoading(false);
  }
}

function useArchivedNextActionsLoader(config: ArchivedNextActionsQueryConfig, state: ArchivedNextActionsLoadState) {
  useEffect(() => {
    let cancelled = false;
    void loadArchivedItems(config, state, () => cancelled);
    return () => { cancelled = true; };
  }, [config, state.reloadToken]);
}

async function recoverItem(
  id: string,
  config: ArchivedNextActionsQueryConfig,
  state: ArchivedNextActionsLoadState,
  mutations: ArchivedNextActionsMutationState,
  poll: () => void
) {
  mutations.setIsUpdating(true);

  try {
    await config.recoverItem(id);
    state.setItems((items) => items.filter((item) => item.id !== id));
    state.setErrorMessageText(null);
    poll();
  } finally {
    mutations.setIsUpdating(false);
  }
}

function useArchivedNextActionsMutations(
  config: ArchivedNextActionsQueryConfig,
  state: ArchivedNextActionsLoadState,
  mutations: ArchivedNextActionsMutationState
) {
  const { triggerSyncStatusPolling } = useSyncStatus();
  return {
    recoverItem: (id: string) => recoverItem(id, config, state, mutations, triggerSyncStatusPolling)
  };
}

/**
 * Loads archived next actions and exposes recover mutation state.
 *
 * @example const query = useArchivedNextActionsQuery(config)
 */
export function useArchivedNextActionsQuery(config: ArchivedNextActionsQueryConfig) {
  const state = useArchivedNextActionsLoadState();
  const mutations = useArchivedNextActionsMutationState();
  const reload = () => state.setReloadToken((value) => value + 1);
  const actions = useArchivedNextActionsMutations(config, state, mutations);

  useArchivedNextActionsLoader(config, state);
  return { ...actions, errorMessage: state.errorMessageText, isLoading: state.isLoading, isUpdating: mutations.isUpdating, items: state.items, reload };
}

export type ArchivedNextActionsQueryState = ArchivedNextActionsQuery;
