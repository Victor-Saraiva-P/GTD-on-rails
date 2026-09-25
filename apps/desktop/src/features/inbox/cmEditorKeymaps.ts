import { moveLineDown, moveLineUp } from "@codemirror/commands";
import type { KeyBinding } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { foldHeadingAtCursor, unfoldHeadingAtCursor } from "./cmHeadingFold.ts";
import { hopMarkerBackward, hopMarkerForward } from "./cmMarkerHop.ts";
import { reflowParagraph } from "./cmReflow.ts";
import { toggleCheckbox } from "./cmToggleCheckbox.ts";
import { toggleWrap, wrapLink } from "./cmFormat.ts";
import { vimNormalModeKeepsItalicChord } from "./cmVimKeymaps.ts";

/**
 * Builds the ZenNotes-inspired editing bindings while preserving Vim NORMAL Ctrl+I.
 */
export function buildZenEditorKeymap(readOnly: boolean): KeyBinding[] {
  return [
    { key: "Mod-b", run: editable(readOnly, (view) => toggleWrap(view, "**")) },
    { key: "Mod-i", run: editable(readOnly, runItalic) },
    { key: "Mod-e", run: editable(readOnly, (view) => toggleWrap(view, "`")) },
    { key: "Mod-k", run: editable(readOnly, wrapLink) },
    { key: "Shift-Mod-s", run: editable(readOnly, (view) => toggleWrap(view, "~~")) },
    { key: "Shift-Mod-h", run: editable(readOnly, (view) => toggleWrap(view, "==")) },
    { key: "Shift-Mod-m", run: editable(readOnly, (view) => toggleWrap(view, "$")) },
    { key: "Mod-l", run: editable(readOnly, toggleCheckbox) },
    { key: "Alt-q", run: editable(readOnly, reflowParagraph) },
    { key: "Alt-]", run: editable(readOnly, hopMarkerForward) },
    { key: "Alt-[", run: editable(readOnly, hopMarkerBackward) },
    { key: "Alt-Mod-f", run: editable(readOnly, foldHeadingAtCursor) },
    { key: "Alt-Mod-u", run: editable(readOnly, unfoldHeadingAtCursor) },
    { key: "Alt-ArrowUp", run: editable(readOnly, moveLineUp) },
    { key: "Alt-ArrowDown", run: editable(readOnly, moveLineDown) }
  ];
}

function editable(
  readOnly: boolean,
  command: (view: EditorView) => boolean
): (view: EditorView) => boolean {
  return (view) => readOnly ? false : command(view);
}

function runItalic(view: EditorView): boolean {
  if (vimNormalModeKeepsItalicChord(view)) return false;
  return toggleWrap(view, "*");
}
