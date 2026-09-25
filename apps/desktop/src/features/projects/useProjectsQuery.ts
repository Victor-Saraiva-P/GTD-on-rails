import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { optimisticMutate } from "../../lib/api/optimistic.ts";
import { mutateSharedEntityOptimistically } from "../../lib/state/optimisticSharedEntity.ts";
import { useSharedCollectionState } from "../../lib/state/sharedEntityStore.ts";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import { useDomainRevalidation } from "../sync-status/domainChanges.ts";
import { deleteProject, fetchDeletedProjects, fetchDoneProjects, fetchProjects, markProjectDone, patchProject, recoverProject, resetProjectStatus } from "./api";
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
  const state = useProjectsLoadState(subview);
  const [isUpdating, setIsUpdating] = useState(false);
  const { triggerSyncStatusPolling } = useSyncStatus();

  const reload = state.reload;
  useDomainRevalidation(["items", "projects", "project_items"], reload);

  useEffect(() => {
    let cancelled = false;
    void loadProjects(subview, () => cancelled, state);
    return () => { cancelled = true; };
  }, [state.reloadToken, subview]);

  return buildProjectsQuery(subview, state, isUpdating, setIsUpdating, triggerSyncStatusPolling);
}

function buildProjectsQuery(subview: ProjectSubview, state: ReturnType<typeof useProjectsLoadState>, isUpdating: boolean, setIsUpdating: (value: boolean) => void, poll: () => void) {
  const actions = projectMutationActions(subview, state, setIsUpdating, poll);
  return { ...actions, errorMessage: state.errorMessage, isLoading: state.isLoading, isUpdating, items: state.items, reload: state.reload };
}

function projectMutationActions(subview: ProjectSubview, state: ReturnType<typeof useProjectsLoadState>, setIsUpdating: (value: boolean) => void, poll: () => void) {
  const patchItem = async (id: string, patch: ProjectPatch) => {
    const project = state.items.find((item) => item.id === id);
    if (!project) return patchProject(id, patch);
    const optimistic: Project = {
      ...project,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.clearDeadline ? { deadline: null } : patch.deadline !== undefined ? { deadline: patch.deadline } : {})
    };
    const updated = await mutateSharedEntityOptimistically(
      project,
      optimistic,
      () => patchProject(id, patch)
    );
    poll();
    return updated;
  };

  const markDone = (id: string) => removeProject(id, markProjectDone, state, setIsUpdating, poll);
  const resetStatus = (id: string) => removeProject(id, resetProjectStatus, state, setIsUpdating, poll);
  const deleteItem = (id: string) => deleteVisibleProject(id, subview, state, setIsUpdating, poll);
  const recoverItem = (id: string) => recoverVisibleProject(id, subview, state, setIsUpdating, poll);
  return { deleteItem, markDone, patchItem, recoverItem, resetStatus };
}

function useProjectsLoadState(subview: ProjectSubview) {
  const collection = useSharedCollectionState<Project>(`projects:${subview}`);
  const [isLoading, setIsLoading] = useState(!collection.loaded);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return {
    errorMessage,
    hasSnapshot: collection.loaded,
    isLoading,
    items: collection.items,
    reload: () => setReloadToken((value) => value + 1),
    reloadToken,
    setErrorMessage,
    setIsLoading,
    setItems: collection.setItems
  };
}

async function loadProjects(subview: ProjectSubview, isCancelled: () => boolean, state: ReturnType<typeof useProjectsLoadState>) {
  if (!state.hasSnapshot) state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    const nextItems = await fetchProjectsForSubview(subview);
    if (!isCancelled()) state.setItems(nextItems);
  } catch (error) {
    if (!isCancelled()) state.setErrorMessage(toErrorMessage(error));
  } finally {
    if (!isCancelled()) state.setIsLoading(false);
  }
}

async function fetchProjectsForSubview(subview: ProjectSubview): Promise<Project[]> {
  if (subview === "active") return fetchProjects();
  if (subview === "completed") return fetchDoneProjects();
  return fetchDeletedProjects();
}

async function removeProject(id: string, action: (id: string) => Promise<unknown>, state: ReturnType<typeof useProjectsLoadState>, setUpdating: (value: boolean) => void, poll: () => void) {
  setUpdating(true);
  try {
    await optimisticMutate({
      current: () => state.items,
      applyOptimistic: (items) => items.filter((project) => project.id !== id),
      set: state.setItems,
      mutate: () => action(id),
      onError: (error) => state.setErrorMessage(toErrorMessage(error))
    });
    state.setErrorMessage(null);
    poll();
  } finally {
    setUpdating(false);
  }
}

async function deleteVisibleProject(id: string, subview: ProjectSubview, state: ReturnType<typeof useProjectsLoadState>, setUpdating: (value: boolean) => void, poll: () => void) {
  await mutateProject(id, deleteProject, state, setUpdating, poll, subview === "deleted");
}

async function recoverVisibleProject(id: string, subview: ProjectSubview, state: ReturnType<typeof useProjectsLoadState>, setUpdating: (value: boolean) => void, poll: () => void) {
  await mutateProject(id, recoverProject, state, setUpdating, poll, subview !== "deleted");
}

async function mutateProject(id: string, action: (id: string) => Promise<unknown>, state: ReturnType<typeof useProjectsLoadState>, setUpdating: (value: boolean) => void, poll: () => void, reload: boolean) {
  setUpdating(true);
  try {
    await action(id);
    reload ? state.reload() : state.setItems((items) => items.filter((project) => project.id !== id));
    poll();
  } finally {
    setUpdating(false);
  }
}
