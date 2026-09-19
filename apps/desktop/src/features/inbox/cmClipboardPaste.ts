import { ViewPlugin, type EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { Vim, getCM, type CodeMirrorV } from "@replit/codemirror-vim";

export interface PatchableRegisterController {
  unnamedRegister?: {
    setText?: (text: string, linewise?: boolean, blockwise?: boolean) => void;
  };
}

export interface PasteKeyboardLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export function isPasteCandidate(e: PasteKeyboardLike): boolean {
  if (e.key !== "p" && e.key !== "P") return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return true;
}

export function isEditorInInsertMode(view: EditorView): boolean {
  const cm = getCM(view);
  const vimState = (cm as unknown as { state?: { vim?: { insertMode?: boolean } } } | null)?.state?.vim;
  return !cm || Boolean(vimState?.insertMode);
}

export function replayVimKey(view: EditorView, key: string): void {
  const cm = getCM(view);
  if (!cm) return;
  try {
    Vim.handleKey(cm as CodeMirrorV, key, "user");
  } catch {
    // Graceful fallback if replay fails
  }
}

export function loadClipboardIntoVimRegister(text: string): void {
  const controller = Vim.getRegisterController() as unknown as PatchableRegisterController | null;
  const isLinewise = /\n$/.test(text);
  controller?.unnamedRegister?.setText?.(text, isLinewise);
}

async function handleAsyncClipboardPaste(view: EditorView, key: string): Promise<void> {
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
  if (!clipboard?.readText) {
    replayVimKey(view, key);
    return;
  }
  try {
    const text = await clipboard.readText();
    if (text) {
      loadClipboardIntoVimRegister(text);
    }
  } catch {
    // Clipboard permission or access denied
  }
  replayVimKey(view, key);
}

export function handlePasteKeyDown(e: KeyboardEvent, view: EditorView): void {
  if (!isPasteCandidate(e)) return;
  if (e.target !== view.contentDOM) return;
  if (isEditorInInsertMode(view)) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  void handleAsyncClipboardPaste(view, e.key);
}

/**
 * CodeMirror extension enabling system clipboard synchronization on normal/visual mode `p` and `P`.
 *
 * @example const extensions = [vimClipboardPasteExtension];
 */
export const vimClipboardPasteExtension: Extension = ViewPlugin.fromClass(
  class {
    private readonly view: EditorView;
    private readonly onKeyDown: (e: KeyboardEvent) => void;

    constructor(view: EditorView) {
      this.view = view;
      this.onKeyDown = (e: KeyboardEvent) => handlePasteKeyDown(e, this.view);
      this.view.contentDOM.addEventListener("keydown", this.onKeyDown, true);
    }

    destroy(): void {
      this.view.contentDOM.removeEventListener("keydown", this.onKeyDown, true);
    }
  }
);
