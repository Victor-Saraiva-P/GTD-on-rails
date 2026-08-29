import { useEffect, useState } from "react";
import type { NextAction } from "./types.ts";
import { fetchOnGoingNextActions } from "./api.ts";
import {
  useNextActionsMutationState,
  useNextActionsMutations,
  toErrorMessage,
  type NextActionsLoadState
} from "./useNextActionsQuery.ts";

/**
 * Loads on going next actions for the active filter and exposes item mutations.
 *
 * @example const query = useOnGoingNextActionsQuery()
 */
export function useOnGoingNextActionsQuery() {
  const [items, setItems] = useState<NextAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const state: NextActionsLoadState = { errorMessage, isLoading, items, reloadToken, setErrorMessage, setIsLoading, setItems, setReloadToken };
  const mutations = useNextActionsMutationState();
  const reload = () => setReloadToken((value) => value + 1);
  const actions = useNextActionsMutations(state, mutations, reload);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const nextItems = await fetchOnGoingNextActions();
        if (!cancelled) setItems(nextItems);
      } catch (error) {
        if (!cancelled) setErrorMessage(toErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [reloadToken]);

  return { ...actions, errorMessage, isDeleting: mutations.isDeleting, isLoading, isUpdating: mutations.isUpdating, items, reload };
}
