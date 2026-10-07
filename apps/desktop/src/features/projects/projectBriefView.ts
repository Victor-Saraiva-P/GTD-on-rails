import type { ItemBody } from "../inbox/types.ts";

export type ProjectBriefVimMode = "NORMAL" | "INSERT" | "VISUAL";

export type ProjectBriefProps = Readonly<{
  body: ItemBody | null;
  errorMessage: string | null;
  isEditing: boolean;
  isLoading: boolean;
  onAutosave: (body: ItemBody) => Promise<void>;
  onExitNormalMode: (body: ItemBody) => Promise<void>;
  onSave: (body: ItemBody) => Promise<void>;
  onVimModeChange: (mode: ProjectBriefVimMode) => void;
  projectId: string | null;
}>;

export type ProjectBriefPresentation = "no-project" | "loading" | "error" | "empty" | "editor";

export type ProjectBriefEditorConfig = Readonly<{
  initialBody: ItemBody;
  itemId: string;
  onAutosave: (body: ItemBody) => Promise<void>;
  onExitNormalMode: (body: ItemBody) => Promise<void>;
  onSave: (body: ItemBody) => Promise<void>;
  onVimModeChange: (mode: ProjectBriefVimMode) => void;
  readOnly: boolean;
}>;

/**
 * Determines the Brief surface to show for its currently loaded state.
 *
 * @example projectBriefPresentation({ projectId: "project-1", body, isEditing: false, ...callbacks })
 */
export function projectBriefPresentation(props: ProjectBriefProps): ProjectBriefPresentation {
  if (!props.projectId) return "no-project";
  if (!props.body && props.errorMessage) return "error";
  if (!props.body || props.isLoading) return "loading";
  if (!props.isEditing && !hasProjectBriefContent(props.body)) return "empty";
  return "editor";
}

/**
 * Preserves the Project Brief contract while adapting it to the shared editor.
 *
 * @example projectBriefEditorConfig({ projectId: "project-1", body, isEditing: true, ...callbacks })
 */
export function projectBriefEditorConfig(props: ProjectBriefProps): ProjectBriefEditorConfig | null {
  if (!props.projectId || !props.body) return null;
  return { initialBody: props.body, itemId: props.projectId, onAutosave: props.onAutosave, onExitNormalMode: props.onExitNormalMode, onSave: props.onSave, onVimModeChange: props.onVimModeChange, readOnly: !props.isEditing };
}

function hasProjectBriefContent(body: ItemBody): boolean {
  return Boolean(body.text.trim()) || body.blockEntities.length > 0;
}
