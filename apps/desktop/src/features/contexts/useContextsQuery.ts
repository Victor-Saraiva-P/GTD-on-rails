import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import {
  createContext,
  deleteContext,
  deleteContextIcon,
  fetchContexts,
  updateContextIcon,
  updateContextName
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

export function useContextsQuery(): ContextsQueryState {
  const { triggerSyncStatusPolling } = useSyncStatus();
  const [contexts, setContexts] = useState<ContextItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadContexts() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextContexts = await fetchContexts();

        if (cancelled) {
          return;
        }

        setContexts(nextContexts);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setContexts([]);
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContexts();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return {
    contexts,
    isLoading,
    isCreating,
    isDeleting,
    isUpdating,
    errorMessage,
    createContext: async (name: string) => {
      setIsCreating(true);

      try {
        const createdContext = await createContext(name);

        setContexts((currentContexts) => [createdContext, ...currentContexts]);
        setErrorMessage(null);
        triggerSyncStatusPolling();

        return createdContext;
      } finally {
        setIsCreating(false);
      }
    },
    deleteContext: async (id: string) => {
      setIsDeleting(true);

      try {
        await deleteContext(id);
        setContexts((currentContexts) => currentContexts.filter((context) => context.id !== id));
        setErrorMessage(null);
        triggerSyncStatusPolling();
      } finally {
        setIsDeleting(false);
      }
    },
    updateContextName: async (id: string, name: string) => {
      setIsUpdating(true);

      try {
        const updatedContext = await updateContextName(id, name);

        setContexts((currentContexts) =>
          currentContexts.map((currentContext) =>
            currentContext.id === updatedContext.id ? updatedContext : currentContext
          )
        );
        setErrorMessage(null);
        triggerSyncStatusPolling();

        return updatedContext;
      } finally {
        setIsUpdating(false);
      }
    },
    updateContextIcon: async (id: string, file: File) => {
      setIsUpdating(true);

      try {
        const updatedContext = await updateContextIcon(id, file);

        setContexts((currentContexts) =>
          currentContexts.map((currentContext) =>
            currentContext.id === updatedContext.id ? updatedContext : currentContext
          )
        );
        setErrorMessage(null);
        triggerSyncStatusPolling();

        return updatedContext;
      } finally {
        setIsUpdating(false);
      }
    },
    deleteContextIcon: async (id: string) => {
      setIsUpdating(true);

      try {
        const updatedContext = await deleteContextIcon(id);

        setContexts((currentContexts) =>
          currentContexts.map((currentContext) =>
            currentContext.id === updatedContext.id ? updatedContext : currentContext
          )
        );
        setErrorMessage(null);
        triggerSyncStatusPolling();

        return updatedContext;
      } finally {
        setIsUpdating(false);
      }
    },
    reload: () => setReloadToken((value) => value + 1)
  };
}
