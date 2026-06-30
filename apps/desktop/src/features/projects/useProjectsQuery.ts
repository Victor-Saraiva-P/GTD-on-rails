import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import { fetchProjects, patchProject } from "./api";
import type { Project, ProjectPatch } from "./types";

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return `Failed to load projects (${error.status})`;
  if (error instanceof Error) return error.message;
  return "Failed to load projects";
}

function replaceProject(projects: Project[], updated: Project): Project[] {
  return projects.map((project) => project.id === updated.id ? updated : project);
}

/**
 * Loads projects and exposes project mutations.
 *
 * @example const projects = useProjectsQuery()
 */
export function useProjectsQuery() {
  const state = useProjectsLoadState();
  const [isUpdating, setIsUpdating] = useState(false);
  const { triggerSyncStatusPolling } = useSyncStatus();

  useEffect(() => {
    let cancelled = false;
    void loadProjects(() => cancelled, state);
    return () => { cancelled = true; };
  }, [state.reloadToken]);

  const patchItem = async (id: string, patch: ProjectPatch) => {
    setIsUpdating(true);
    try {
      const updated = await patchProject(id, patch);
      state.setItems((current) => replaceProject(current, updated));
      triggerSyncStatusPolling();
      return updated;
    } finally {
      setIsUpdating(false);
    }
  };

  return { errorMessage: state.errorMessage, isLoading: state.isLoading, isUpdating, items: state.items, patchItem, reload: state.reload };
}

function useProjectsLoadState() {
  const [items, setItems] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return { errorMessage, isLoading, items, reload: () => setReloadToken((value) => value + 1), reloadToken, setErrorMessage, setIsLoading, setItems };
}

async function loadProjects(isCancelled: () => boolean, state: ReturnType<typeof useProjectsLoadState>) {
  state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    const nextItems = await fetchProjects();
    if (!isCancelled()) state.setItems(nextItems);
  } catch (error) {
    if (!isCancelled()) state.setErrorMessage(toErrorMessage(error));
  } finally {
    if (!isCancelled()) state.setIsLoading(false);
  }
}
