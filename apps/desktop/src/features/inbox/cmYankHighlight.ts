import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { Vim } from "@replit/codemirror-vim";
import { getActiveEditorView } from "../keybinds/activeEditorRegistry.ts";

const FLASH_DURATION_MS = 160;

export const setYankHighlightEffect = StateEffect.define<readonly { from: number; to: number }[] | null>();

const yankMarkDecoration = Decoration.mark({ class: "cm-yank-highlight" });

export const yankHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let mapped = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setYankHighlightEffect)) {
        mapped = effect.value
          ? Decoration.set(effect.value.map((range) => yankMarkDecoration.range(range.from, range.to)))
          : Decoration.none;
      }
    }
    return mapped;
  },
  provide: (field) => EditorView.decorations.from(field)
});

export const yankHighlightExtension: Extension = [yankHighlightField];

const activeClearTimers = new WeakMap<EditorView, ReturnType<typeof setTimeout>>();

function filterValidRanges(view: EditorView, ranges: readonly { from: number; to: number }[]) {
  const docLength = view.state.doc.length;
  return ranges
    .map((r) => ({
      from: Math.max(0, Math.min(r.from, docLength)),
      to: Math.max(0, Math.min(r.to, docLength))
    }))
    .filter((r) => r.to > r.from);
}

function clearPendingTimer(view: EditorView): void {
  const existing = activeClearTimers.get(view);
  if (existing) clearTimeout(existing);
}

function scheduleYankClear(view: EditorView): void {
  clearPendingTimer(view);
  const timer = setTimeout(() => {
    activeClearTimers.delete(view);
    try {
      view.dispatch({ effects: setYankHighlightEffect.of(null) });
    } catch {
      // View might already be destroyed
    }
  }, FLASH_DURATION_MS);
  activeClearTimers.set(view, timer);
}

/**
 * Triggers a temporary highlight over the yanked text ranges.
 *
 * @example flashYankHighlight(view, ranges)
 */
export function flashYankHighlight(view: EditorView, ranges: readonly { from: number; to: number }[]): void {
  const validRanges = filterValidRanges(view, ranges);
  if (validRanges.length === 0) return;
  setTimeout(() => {
    try {
      view.dispatch({ effects: setYankHighlightEffect.of(validRanges) });
      scheduleYankClear(view);
    } catch {
      // Ignored if view update cannot be dispatched
    }
  }, 0);
}

function triggerYankHighlight(): void {
  const view = getActiveEditorView();
  if (!view) return;
  const ranges = view.state.selection.ranges.map((r) => ({ from: r.from, to: r.to }));
  flashYankHighlight(view, ranges);
}

function syncTextToSystemClipboard(text: string): void {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && text) {
    void navigator.clipboard.writeText(text).catch(() => {});
  }
}

let yankWired = false;

/**
 * Wires the CodeMirror Vim yank handler to flash highlights and sync clipboard.
 *
 * @example wireYankHighlight()
 */
export function wireYankHighlight(): void {
  if (yankWired) return;
  yankWired = true;
  const controller = Vim.getRegisterController() as {
    pushText: (name: string | null | undefined, op: string, text: string, line?: boolean, block?: boolean) => void;
  } | null;
  if (!controller || typeof controller.pushText !== "function") return;
  const original = controller.pushText.bind(controller);
  controller.pushText = (name, op, text, line, block) => {
    original(name, op, text, line, block);
    if (op === "yank") {
      syncTextToSystemClipboard(text);
      triggerYankHighlight();
    }
  };
}
