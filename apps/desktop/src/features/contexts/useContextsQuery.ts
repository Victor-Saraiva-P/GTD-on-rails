import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import {
  createContext as createContextRequest,
  deleteContext as deleteContextRequest,
  deleteContextIcon as deleteContextIconRequest,
  fetchContexts,
  updateContextIcon as updateContextIconRequest,
  updateContextName as updateContextNameRequest
} from "./api";
import type { ContextItem } from "./types";

type ContextsQueryState = {
  contexts: ContextItem[];
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  errorMessage: string | null;
  createContext: (name: string) => Promise<ContextItem>;
  deleteContext: (id: string) => Promise<void>;
  updateContextName: (id: string, name: string) => Promise<ContextItem>;
  updateContextIcon: (id: string, file: File) => Promise<ContextItem>;
  deleteContextIcon: (id: string) => Promise<ContextItem>;
  reload: () => void;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return `Failed to load contexts (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load contexts";
}

function useContextsLoadState() {
  const [contexts, setContexts] = useState<ContextItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  return { contexts, errorMessage, isLoading, reloadToken, setContexts, setErrorMessage, setIsLoading, setReloadToken };
}

function useContextsMutationState() {
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  return { isCreating, isDeleting, isUpdating, setIsCreating, setIsDeleting, setIsUpdating };
}

type ContextsLoadState = ReturnType<typeof useContextsLoadState>;
type ContextsMutationState = ReturnType<typeof useContextsMutationState>;

function startContextsLoad(state: ContextsLoadState) {
  state.setIsLoading(true);
  state.setErrorMessage(null);
}

function failContextsLoad(state: ContextsLoadState, error: unknown) {
  state.setContexts([]);
  state.setErrorMessage(toErrorMessage(error));
}

async function loadContexts(state: ContextsLoadState, isCancelled: () => boolean) {
  startContextsLoad(state);

  try {
    const nextContexts = await fetchContexts();

    if (!isCancelled()) {
      state.setContexts(nextContexts);
    }
  } catch (error) {
    if (!isCancelled()) {
      failContextsLoad(state, error);
    }
  } finally {
    if (!isCancelled()) {
      state.setIsLoading(false);
    }
  }
}

function useContextsLoader(state: ContextsLoadState) {
  useEffect(() => {
    let cancelled = false;

    void loadContexts(state, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [state.reloadToken]);
}

function completeContextMutation(state: ContextsLoadState, triggerSyncStatusPolling: () => void) {
  state.setErrorMessage(null);
  triggerSyncStatusPolling();
}

function replaceContext(currentContexts: ContextItem[], updatedContext: ContextItem): ContextItem[] {
  return currentContexts.map((context) =>
    context.id === updatedContext.id ? updatedContext : context
  );
}

async function createContextItem(name: string, state: ContextsLoadState, mutations: ContextsMutationState, triggerSyncStatusPolling: () => void) {
  mutations.setIsCreating(true);

  try {
    const createdContext = await createContextRequest(name);
    state.setContexts((currentContexts) => [createdContext, ...currentContexts]);
    completeContextMutation(state, triggerSyncStatusPolling);
    return createdContext;
  } finally {
    mutations.setIsCreating(false);
  }
}

async function deleteContextItem(id: string, state: ContextsLoadState, mutations: ContextsMutationState, triggerSyncStatusPolling: () => void) {
  mutations.setIsDeleting(true);

  try {
    await deleteContextRequest(id);
    state.setContexts((currentContexts) => currentContexts.filter((context) => context.id !== id));
    completeContextMutation(state, triggerSyncStatusPolling);
  } finally {
    mutations.setIsDeleting(false);
  }
}

async function updateContextItem(updateRequest: () => Promise<ContextItem>, state: ContextsLoadState, mutations: ContextsMutationState, triggerSyncStatusPolling: () => void) {
  mutations.setIsUpdating(true);

  try {
    const updatedContext = await updateRequest();
    state.setContexts((currentContexts) => replaceContext(currentContexts, updatedContext));
    completeContextMutation(state, triggerSyncStatusPolling);
    return updatedContext;
  } finally {
    mutations.setIsUpdating(false);
  }
}

function useContextsMutations(state: ContextsLoadState, mutations: ContextsMutationState) {
  const { triggerSyncStatusPolling } = useSyncStatus();

  return {
    createContext: (name: string) => createContextItem(name, state, mutations, triggerSyncStatusPolling),
    deleteContext: (id: string) => deleteContextItem(id, state, mutations, triggerSyncStatusPolling),
    deleteContextIcon: (id: string) => updateContextItem(() => deleteContextIconRequest(id), state, mutations, triggerSyncStatusPolling),
    updateContextIcon: (id: string, file: File) => updateContextItem(() => updateContextIconRequest(id, file), state, mutations, triggerSyncStatusPolling),
    updateContextName: (id: string, name: string) => updateContextItem(() => updateContextNameRequest(id, name), state, mutations, triggerSyncStatusPolling)
  };
}

export function useContextsQuery(): ContextsQueryState {
  const state = useContextsLoadState();
  const mutations = useContextsMutationState();
  const actions = useContextsMutations(state, mutations);

  useContextsLoader(state);
  return {
    ...actions,
    contexts: state.contexts,
    errorMessage: state.errorMessage,
    isCreating: mutations.isCreating,
    isDeleting: mutations.isDeleting,
    isLoading: state.isLoading,
    isUpdating: mutations.isUpdating,
    reload: () => state.setReloadToken((value) => value + 1)
  };
}
