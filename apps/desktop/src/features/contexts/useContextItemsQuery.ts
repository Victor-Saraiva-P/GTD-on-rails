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

export function useContextItemsQuery(
  contextId: string | null,
  limit: number
): ContextItemsQueryState {
  const [items, setItems] = useState<ContextRelatedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadContextItems() {
      if (!contextId) {
        setItems([]);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextItems = await fetchContextItems(contextId, limit);

        if (cancelled) {
          return;
        }

        setItems(nextItems);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setItems([]);
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContextItems();

    return () => {
      cancelled = true;
    };
  }, [contextId, limit, reloadToken]);

  return {
    items,
    isLoading,
    errorMessage,
    reload: () => setReloadToken((value) => value + 1)
  };
}
