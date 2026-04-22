import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { fetchInboxStuffs } from "./api";
import type { Stuff } from "./types";

type InboxStuffsQueryState = {
  stuffs: Stuff[];
  isLoading: boolean;
  errorMessage: string | null;
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

export function useInboxStuffsQuery(): InboxStuffsQueryState {
  const [stuffs, setStuffs] = useState<Stuff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadInboxStuffs() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextStuffs = await fetchInboxStuffs();

        if (cancelled) {
          return;
        }

        setStuffs(nextStuffs);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStuffs([]);
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInboxStuffs();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return {
    stuffs,
    isLoading,
    errorMessage,
    reload: () => setReloadToken((value) => value + 1)
  };
}
