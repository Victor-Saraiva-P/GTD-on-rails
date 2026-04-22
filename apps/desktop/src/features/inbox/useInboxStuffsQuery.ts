import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { createStuff, deleteStuff, fetchInboxStuffs, updateStuffBody, updateStuffTitle } from "./api";
import type { Stuff } from "./types";

type InboxStuffsQueryState = {
  stuffs: Stuff[];
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  errorMessage: string | null;
  createStuff: () => Promise<Stuff>;
  deleteStuff: (id: string) => Promise<void>;
  updateStuffBody: (item: Stuff, body: string | null) => Promise<Stuff>;
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

export function useInboxStuffsQuery(): InboxStuffsQueryState {
  const [stuffs, setStuffs] = useState<Stuff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
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
    isCreating,
    isDeleting,
    isUpdating,
    errorMessage,
    createStuff: async () => {
      setIsCreating(true);

      try {
        const createdStuff = await createStuff();

        setStuffs((currentStuffs) => [createdStuff, ...currentStuffs]);
        setErrorMessage(null);

        return createdStuff;
      } finally {
        setIsCreating(false);
      }
    },
    deleteStuff: async (id: string) => {
      setIsDeleting(true);

      try {
        await deleteStuff(id);
        setStuffs((currentStuffs) => currentStuffs.filter((stuff) => stuff.id !== id));
        setErrorMessage(null);
      } finally {
        setIsDeleting(false);
      }
    },
    updateStuffBody: async (item: Stuff, body: string | null) => {
      setIsUpdating(true);

      try {
        const updatedStuff = await updateStuffBody(item, body);

        setStuffs((currentStuffs) =>
          currentStuffs.map((currentStuff) =>
            currentStuff.id === updatedStuff.id ? updatedStuff : currentStuff
          )
        );
        setErrorMessage(null);

        return updatedStuff;
      } finally {
        setIsUpdating(false);
      }
    },
    updateStuffTitle: async (item: Stuff, title: string) => {
      setIsUpdating(true);

      try {
        const updatedStuff = await updateStuffTitle(item, title);

        setStuffs((currentStuffs) =>
          currentStuffs.map((currentStuff) =>
            currentStuff.id === updatedStuff.id ? updatedStuff : currentStuff
          )
        );
        setErrorMessage(null);

        return updatedStuff;
      } finally {
        setIsUpdating(false);
      }
    },
    reload: () => setReloadToken((value) => value + 1)
  };
}
