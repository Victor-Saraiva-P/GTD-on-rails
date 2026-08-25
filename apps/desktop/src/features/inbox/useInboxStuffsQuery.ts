import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { processStuffToCalendar as processStuffToCalendarRequest } from "../calendar/api";
import type { CalendarConversionPayload } from "../calendar/types";
import { processStuffToProject as processStuffToProjectRequest } from "../projects/api";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import {
  createStuff as createStuffRequest,
  deleteStuff as deleteStuffRequest,
  fetchInboxStuffs,
  processStuff as processStuffRequest,
  restoreStuff as restoreStuffRequest,
  updateStuffBody as updateStuffBodyRequest,
  updateStuffTitle as updateStuffTitleRequest
} from "./api";
import { removeProcessedInboxStuff } from "./inboxStuffCollections";
import type { Stuff, ItemBody } from "./types";

type InboxStuffsQueryState = {
  stuffs: Stuff[];
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  errorMessage: string | null;
  createStuff: (title: string) => Promise<Stuff>;
  deleteStuff: (id: string) => Promise<void>;
  processStuff: (item: Stuff, energy: number | null, estimatedTimeMinutes: number | null, contextIds: string[], deadline: string | null) => Promise<void>;
  processStuffToCalendar: (item: Stuff, payload: CalendarConversionPayload) => Promise<void>;
  processStuffToProject: (item: Stuff, deadline: string | null) => Promise<void>;
  restoreStuff: (id: string) => Promise<void>;
  updateStuffBody: (item: Stuff, body: ItemBody) => Promise<Stuff>;
  updateStuffTitle: (item: Stuff, title: string) => Promise<Stuff>;
  reload: () => void;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return `Failed to load inbox (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load inbox";
}

function useInboxLoadState() {
  const [stuffs, setStuffs] = useState<Stuff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  return { errorMessage, isLoading, reloadToken, setErrorMessage, setIsLoading, setReloadToken, setStuffs, stuffs };
}

function useInboxMutationState() {
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  return { isCreating, isDeleting, isUpdating, setIsCreating, setIsDeleting, setIsUpdating };
}

type InboxLoadState = ReturnType<typeof useInboxLoadState>;
type InboxMutationState = ReturnType<typeof useInboxMutationState>;

function startInboxLoad(state: InboxLoadState) {
  state.setIsLoading(true);
  state.setErrorMessage(null);
}

function failInboxLoad(state: InboxLoadState, error: unknown) {
  state.setStuffs([]);
  state.setErrorMessage(toErrorMessage(error));
}

async function loadInboxStuffs(state: InboxLoadState, isCancelled: () => boolean) {
  startInboxLoad(state);

  try {
    const nextStuffs = await fetchInboxStuffs();

    if (!isCancelled()) {
      state.setStuffs(nextStuffs);
    }
  } catch (error) {
    if (!isCancelled()) {
      failInboxLoad(state, error);
    }
  } finally {
    if (!isCancelled()) {
      state.setIsLoading(false);
    }
  }
}

function useInboxStuffsLoader(state: InboxLoadState) {
  useEffect(() => {
    let cancelled = false;

    void loadInboxStuffs(state, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [state.reloadToken]);
}

function completeInboxMutation(state: InboxLoadState, triggerSyncStatusPolling: () => void) {
  state.setErrorMessage(null);
  triggerSyncStatusPolling();
}

async function createInboxStuff(title: string, state: InboxLoadState, mutations: InboxMutationState, triggerSyncStatusPolling: () => void) {
  mutations.setIsCreating(true);

  try {
    const createdStuff = await createStuffRequest(title);
    state.setStuffs((currentStuffs) => [...currentStuffs, createdStuff]);
    completeInboxMutation(state, triggerSyncStatusPolling);
    return createdStuff;
  } finally {
    mutations.setIsCreating(false);
  }
}

async function deleteInboxStuff(id: string, state: InboxLoadState, mutations: InboxMutationState, triggerSyncStatusPolling: () => void) {
  mutations.setIsDeleting(true);

  try {
    await deleteStuffRequest(id);
    state.setStuffs((currentStuffs) => currentStuffs.filter((stuff) => stuff.id !== id));
    completeInboxMutation(state, triggerSyncStatusPolling);
  } finally {
    mutations.setIsDeleting(false);
  }
}

async function restoreInboxStuff(id: string, state: InboxLoadState, mutations: InboxMutationState, triggerSyncStatusPolling: () => void) {
  mutations.setIsUpdating(true);

  try {
    await restoreStuffRequest(id);
    const nextStuffs = await fetchInboxStuffs();
    state.setStuffs(nextStuffs);
    completeInboxMutation(state, triggerSyncStatusPolling);
  } finally {
    mutations.setIsUpdating(false);
  }
}

function replaceStuff(currentStuffs: Stuff[], updatedStuff: Stuff): Stuff[] {
  return currentStuffs.map((currentStuff) =>
    currentStuff.id === updatedStuff.id ? updatedStuff : currentStuff
  );
}

async function updateInboxStuff(updateRequest: () => Promise<Stuff>, state: InboxLoadState, mutations: InboxMutationState, triggerSyncStatusPolling: () => void) {
  mutations.setIsUpdating(true);

  try {
    const updatedStuff = await updateRequest();
    state.setStuffs((currentStuffs) => replaceStuff(currentStuffs, updatedStuff));
    completeInboxMutation(state, triggerSyncStatusPolling);
    return updatedStuff;
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function processInboxStuff(item: Stuff, processRequest: () => Promise<void>, state: InboxLoadState, mutations: InboxMutationState, triggerSyncStatusPolling: () => void) {
  mutations.setIsUpdating(true);

  try {
    await processRequest();
    state.setStuffs((currentStuffs) => removeProcessedInboxStuff(currentStuffs, item.id));
    completeInboxMutation(state, triggerSyncStatusPolling);
  } finally {
    mutations.setIsUpdating(false);
  }
}

function useInboxStuffsMutations(state: InboxLoadState, mutations: InboxMutationState) {
  const { triggerSyncStatusPolling } = useSyncStatus();

  return {
    createStuff: (title: string) => createInboxStuff(title, state, mutations, triggerSyncStatusPolling),
    deleteStuff: (id: string) => deleteInboxStuff(id, state, mutations, triggerSyncStatusPolling),
    processStuffToCalendar: (item: Stuff, payload: CalendarConversionPayload) => processInboxStuff(item, () => processStuffToCalendarRequest(item, payload), state, mutations, triggerSyncStatusPolling),
    processStuffToProject: (item: Stuff, deadline: string | null) => processInboxStuff(item, () => processStuffToProjectRequest(item, deadline), state, mutations, triggerSyncStatusPolling),
    processStuff: (item: Stuff, energy: number | null, estimatedTimeMinutes: number | null, contextIds: string[], deadline: string | null) => processInboxStuff(item, () => processStuffRequest(item, energy, estimatedTimeMinutes, contextIds, deadline), state, mutations, triggerSyncStatusPolling),
    restoreStuff: (id: string) => restoreInboxStuff(id, state, mutations, triggerSyncStatusPolling),
    updateStuffBody: (item: Stuff, body: ItemBody) => updateInboxStuff(() => updateStuffBodyRequest(item, body), state, mutations, triggerSyncStatusPolling),
    updateStuffTitle: (item: Stuff, title: string) => updateInboxStuff(() => updateStuffTitleRequest(item, title), state, mutations, triggerSyncStatusPolling)
  };
}

/**
 * Loads inbox stuff and exposes create, update, and delete mutations.
 *
 * @example const inbox = useInboxStuffsQuery()
 */
export function useInboxStuffsQuery(): InboxStuffsQueryState {
  const state = useInboxLoadState();
  const mutations = useInboxMutationState();
  const actions = useInboxStuffsMutations(state, mutations);

  useInboxStuffsLoader(state);
  return {
    ...actions,
    errorMessage: state.errorMessage,
    isCreating: mutations.isCreating,
    isDeleting: mutations.isDeleting,
    isLoading: state.isLoading,
    isUpdating: mutations.isUpdating,
    reload: () => state.setReloadToken((value) => value + 1),
    stuffs: state.stuffs
  };
}
