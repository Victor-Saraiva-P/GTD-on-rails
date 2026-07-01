import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import { fetchDoneProjects, fetchProjects, markProjectDone, patchProject, resetProjectStatus } from "./api";
import type { ProjectSubview } from "./projectSubview";
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
 * @example const projects = useProjectsQuery("active")
 */
export function useProjectsQuery(subview: ProjectSubview) {
  const state = useProjectsLoadState();
  const [isUpdating, setIsUpdating] = useState(false);
  const { triggerSyncStatusPolling } = useSyncStatus();

  useEffect(() => {
    let cancelled = false;
    void loadProjects(subview, () => cancelled, state);
    return () => { cancelled = true; };
  }, [state.reloadToken, subview]);

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

  const markDone = (id: string) => moveProject(id, markProjectDone, state, setIsUpdating, triggerSyncStatusPolling);
  const resetStatus = (id: string) => moveProject(id, resetProjectStatus, state, setIsUpdating, triggerSyncStatusPolling);
  return { errorMessage: state.errorMessage, isLoading: state.isLoading, isUpdating, items: state.items, markDone, patchItem, reload: state.reload, resetStatus };
}

function useProjectsLoadState() {
  const [items, setItems] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return { errorMessage, isLoading, items, reload: () => setReloadToken((value) => value + 1), reloadToken, setErrorMessage, setIsLoading, setItems };
}

async function loadProjects(subview: ProjectSubview, isCancelled: () => boolean, state: ReturnType<typeof useProjectsLoadState>) {
  state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    const nextItems = subview === "active" ? await fetchProjects() : await fetchDoneProjects();
    if (!isCancelled()) state.setItems(nextItems);
  } catch (error) {
    if (!isCancelled()) state.setErrorMessage(toErrorMessage(error));
  } finally {
    if (!isCancelled()) state.setIsLoading(false);
  }
}

async function moveProject(id: string, action: (id: string) => Promise<Project>, state: ReturnType<typeof useProjectsLoadState>, setUpdating: (value: boolean) => void, poll: () => void) {
  setUpdating(true);
  try {
    await action(id);
    state.setItems((items) => items.filter((project) => project.id !== id));
    poll();
  } finally {
    setUpdating(false);
  }
}
