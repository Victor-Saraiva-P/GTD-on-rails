import type { ItemBody } from "../inbox/types.ts";

export type ProjectBriefVimMode = "NORMAL" | "INSERT" | "VISUAL" | null;

export type ProjectBriefState = Readonly<{
  body: ItemBody | null;
  errorMessage: string | null;
  isEditing: boolean;
  isLoading: boolean;
  projectId: string | null;
  vimMode: ProjectBriefVimMode;
}>;

/**
 * Creates an unloaded Project Brief state.
 *
 * @example const state = emptyProjectBriefState()
 */
export function emptyProjectBriefState(): ProjectBriefState {
  return { body: null, errorMessage: null, isEditing: false, isLoading: false, projectId: null, vimMode: null };
}

/**
 * Starts a canonical body request for one project's backing Item.
 *
 * @example const state = beginProjectBriefLoad("project-1")
 */
export function beginProjectBriefLoad(projectId: string): ProjectBriefState {
  return { ...emptyProjectBriefState(), isLoading: true, projectId };
}

/**
 * Applies a body response only when it belongs to the current project.
 *
 * @example resolveProjectBriefLoad(state, "project-1", body)
 */
export function resolveProjectBriefLoad(state: ProjectBriefState, projectId: string, body: ItemBody): ProjectBriefState {
  if (state.projectId !== projectId) return state;
  return { ...state, body, errorMessage: null, isLoading: false };
}

/**
 * Records a failed body request only when it belongs to the current project.
 *
 * @example failProjectBriefLoad(state, "project-1", "Request failed")
 */
export function failProjectBriefLoad(state: ProjectBriefState, projectId: string, errorMessage: string): ProjectBriefState {
  if (state.projectId !== projectId) return state;
  return { ...state, errorMessage, isLoading: false };
}

/**
 * Records a persistence error while retaining the optimistic Brief snapshot.
 *
 * @example setProjectBriefError(state, "Unable to save body")
 */
export function setProjectBriefError(state: ProjectBriefState, errorMessage: string): ProjectBriefState {
  return { ...state, errorMessage };
}

/**
 * Opens the Brief editor after its canonical body has loaded.
 *
 * @example const editing = startProjectBriefEditing(state)
 */
export function startProjectBriefEditing(state: ProjectBriefState): ProjectBriefState {
  if (!state.body) return state;
  return { ...state, isEditing: true };
}

/**
 * Applies an optimistic Brief body snapshot for the active project.
 *
 * @example const updated = setProjectBriefBody(state, body)
 */
export function setProjectBriefBody(state: ProjectBriefState, body: ItemBody): ProjectBriefState {
  return { ...state, body, errorMessage: null };
}

/**
 * Publishes the editor's current Vim mode for the detail workspace.
 *
 * @example const updated = setProjectBriefVimMode(state, "INSERT")
 */
export function setProjectBriefVimMode(state: ProjectBriefState, vimMode: ProjectBriefVimMode): ProjectBriefState {
  return { ...state, vimMode };
}

/**
 * Leaves Brief editing after the Markdown editor has persisted its final state.
 *
 * @example const preview = finishProjectBriefEditing(state)
 */
export function finishProjectBriefEditing(state: ProjectBriefState): ProjectBriefState {
  return { ...state, isEditing: false, vimMode: null };
}
