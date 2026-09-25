import { getCM } from "@replit/codemirror-vim";
import type { EditorView } from "@codemirror/view";
import { getActiveEditorView } from "./activeEditorRegistry.ts";

interface VimPluginState {
  expectLiteralNext?: boolean;
  inputState?: {
    keyBuffer?: unknown[];
    operator?: unknown;
  };
}

/**
 * Inspects whether a given EditorView Vim plugin state is awaiting an argument.
 *
 * @example isVimAwaitingArgument(view)
 */
export function isVimAwaitingArgument(view: EditorView | null): boolean {
  if (!view) return false;
  const cm = getCM(view);
  const vim = cm?.state?.vim as VimPluginState | undefined;
  if (!vim) return false;
  if (vim.expectLiteralNext) return true;
  return (vim.inputState?.keyBuffer?.length ?? 0) > 0;
}

/**
 * Checks if the currently active registered editor is awaiting a Vim argument.
 *
 * @example const awaiting = isVimEditorAwaitingArgument()
 */
export function isVimEditorAwaitingArgument(): boolean {
  const view = getActiveEditorView();
  return isVimAwaitingArgument(view);
}
