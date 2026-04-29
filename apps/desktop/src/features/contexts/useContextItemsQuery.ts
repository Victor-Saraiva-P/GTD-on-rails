import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { fetchContextItems } from "./api";
import type { ContextRelatedItem } from "./types";

type ContextItemsQueryState = {
  items: ContextRelatedItem[];
  isLoading: boolean;
  errorMessage: string | null;
  reload: () => void;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return `Failed to load related items (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load related items";
}

function useContextItemsState() {
  const [items, setItems] = useState<ContextRelatedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  return { errorMessage, isLoading, items, reloadToken, setErrorMessage, setIsLoading, setItems, setReloadToken };
}

type ContextItemsState = ReturnType<typeof useContextItemsState>;

function resetContextItems(state: ContextItemsState) {
  state.setItems([]);
  state.setErrorMessage(null);
  state.setIsLoading(false);
}

function startContextItemsLoad(state: ContextItemsState) {
  state.setIsLoading(true);
  state.setErrorMessage(null);
}

function failContextItemsLoad(state: ContextItemsState, error: unknown) {
  state.setItems([]);
  state.setErrorMessage(toErrorMessage(error));
}

function finishContextItemsLoad(state: ContextItemsState, isCancelled: () => boolean) {
  if (!isCancelled()) {
    state.setIsLoading(false);
  }
}

async function loadContextItems(
  state: ContextItemsState,
  contextId: string | null,
  limit: number,
  isCancelled: () => boolean
) {
  if (!contextId) {
    resetContextItems(state);
    return;
  }

  startContextItemsLoad(state);
  await loadContextItemsFromApi(state, contextId, limit, isCancelled);
}

async function loadContextItemsFromApi(
  state: ContextItemsState,
  contextId: string,
  limit: number,
  isCancelled: () => boolean
) {
  try {
    const nextItems = await fetchContextItems(contextId, limit);

    if (!isCancelled()) {
      state.setItems(nextItems);
    }
  } catch (error) {
    if (!isCancelled()) {
      failContextItemsLoad(state, error);
    }
  } finally {
    finishContextItemsLoad(state, isCancelled);
  }
}

function useContextItemsLoader(state: ContextItemsState, contextId: string | null, limit: number) {
  useEffect(() => {
    let cancelled = false;

    void loadContextItems(state, contextId, limit, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [contextId, limit, state.reloadToken]);
}

export function useContextItemsQuery(contextId: string | null, limit: number): ContextItemsQueryState {
  const state = useContextItemsState();

  useContextItemsLoader(state, contextId, limit);

  return {
    errorMessage: state.errorMessage,
    isLoading: state.isLoading,
    items: state.items,
    reload: () => state.setReloadToken((value) => value + 1)
  };
}
