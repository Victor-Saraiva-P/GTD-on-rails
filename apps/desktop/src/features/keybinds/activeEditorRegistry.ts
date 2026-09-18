import type { EditorView } from "@codemirror/view";

let activeEditorViewInstance: EditorView | null = null;

/**
 * Registers the currently focused CodeMirror EditorView.
 *
 * @example registerActiveEditorView(editorView)
 */
export function registerActiveEditorView(view: EditorView | null): void {
  activeEditorViewInstance = view;
}

/**
 * Returns the currently focused CodeMirror EditorView, if any.
 *
 * @example const view = getActiveEditorView()
 */
export function getActiveEditorView(): EditorView | null {
  return activeEditorViewInstance;
}
