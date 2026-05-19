import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import { fetchDeletedInboxStuffs, restoreStuff as restoreStuffRequest } from "./api";
import type { Stuff } from "./types";

type DeletedStuffsQueryState = {
  stuffs: Stuff[];
  isLoading: boolean;
  isUpdating: boolean;
  errorMessage: string | null;
  reload: () => void;
  restoreStuff: (id: string) => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return `Failed to load deleted stuff (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load deleted stuff";
}

function useDeletedStuffsLoadState() {
  const [stuffs, setStuffs] = useState<Stuff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  return { errorMessage, isLoading, reloadToken, setErrorMessage, setIsLoading, setReloadToken, setStuffs, stuffs };
}

function useDeletedStuffsMutationState() {
  const [isUpdating, setIsUpdating] = useState(false);

  return { isUpdating, setIsUpdating };
}

type DeletedStuffsLoadState = ReturnType<typeof useDeletedStuffsLoadState>;
type DeletedStuffsMutationState = ReturnType<typeof useDeletedStuffsMutationState>;

function startDeletedStuffsLoad(state: DeletedStuffsLoadState) {
  state.setIsLoading(true);
  state.setErrorMessage(null);
}

function failDeletedStuffsLoad(state: DeletedStuffsLoadState, error: unknown) {
  state.setStuffs([]);
  state.setErrorMessage(toErrorMessage(error));
}

async function loadDeletedStuffs(state: DeletedStuffsLoadState, isCancelled: () => boolean) {
  startDeletedStuffsLoad(state);

  try {
    const nextStuffs = await fetchDeletedInboxStuffs();

    if (!isCancelled()) {
      state.setStuffs(nextStuffs);
    }
  } catch (error) {
    if (!isCancelled()) {
      failDeletedStuffsLoad(state, error);
    }
  } finally {
    if (!isCancelled()) {
      state.setIsLoading(false);
    }
  }
}

function useDeletedStuffsLoader(state: DeletedStuffsLoadState) {
  useEffect(() => {
    let cancelled = false;

    void loadDeletedStuffs(state, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [state.reloadToken]);
}

function completeDeletedMutation(state: DeletedStuffsLoadState, triggerSyncStatusPolling: () => void) {
  state.setErrorMessage(null);
  triggerSyncStatusPolling();
}

async function restoreDeletedStuff(
  id: string,
  state: DeletedStuffsLoadState,
  mutations: DeletedStuffsMutationState,
  triggerSyncStatusPolling: () => void
) {
  mutations.setIsUpdating(true);

  try {
    await restoreStuffRequest(id);
    const nextStuffs = await fetchDeletedInboxStuffs();
    state.setStuffs(nextStuffs);
    completeDeletedMutation(state, triggerSyncStatusPolling);
  } finally {
    mutations.setIsUpdating(false);
  }
}

function useDeletedStuffsMutations(state: DeletedStuffsLoadState, mutations: DeletedStuffsMutationState) {
  const { triggerSyncStatusPolling } = useSyncStatus();

  return {
    restoreStuff: (id: string) => restoreDeletedStuff(id, state, mutations, triggerSyncStatusPolling)
  };
}

/**
 * Loads deleted inbox stuff and exposes restore mutation.
 *
 * @example const deleted = useDeletedStuffsQuery()
 */
export function useDeletedStuffsQuery(): DeletedStuffsQueryState {
  const state = useDeletedStuffsLoadState();
  const mutations = useDeletedStuffsMutationState();
  const actions = useDeletedStuffsMutations(state, mutations);

  useDeletedStuffsLoader(state);
  return {
    ...actions,
    errorMessage: state.errorMessage,
    isLoading: state.isLoading,
    isUpdating: mutations.isUpdating,
    reload: () => state.setReloadToken((value) => value + 1),
    stuffs: state.stuffs
  };
}
