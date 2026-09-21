import { EditorSelection, type EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

const MARKERS = new Set(["*", "~", "=", "`", "$", "(", ")", "[", "]", "{", "}"]);

/**
 * Returns the cursor column after the next marker run or before the previous one.
 *
 * @example markerHopTarget("**bold**", 6, 1) // 8
 */
export function markerHopTarget(text: string, column: number, direction: 1 | -1): number | null {
  return direction === 1
    ? forwardMarkerTarget(text, column)
    : backwardMarkerTarget(text, column);
}

function forwardMarkerTarget(text: string, column: number): number | null {
  let index = column;
  while (index < text.length && !MARKERS.has(text[index])) index += 1;
  if (index >= text.length) return null;
  const marker = text[index];
  while (index < text.length && text[index] === marker) index += 1;
  return index;
}

function backwardMarkerTarget(text: string, column: number): number | null {
  let index = column - 1;
  while (index >= 0 && !MARKERS.has(text[index])) index -= 1;
  if (index < 0) return null;
  const marker = text[index];
  while (index >= 0 && text[index] === marker) index -= 1;
  return index + 1;
}

function hopSelection(state: EditorState, direction: 1 | -1): {
  selection: EditorSelection;
  moved: boolean;
} {
  let moved = false;
  const ranges = state.selection.ranges.map((range) => {
    const line = state.doc.lineAt(range.head);
    const column = range.head - line.from;
    const target = markerHopTarget(line.text, column, direction);
    if (target === null) return EditorSelection.cursor(range.head);
    moved = true;
    return EditorSelection.cursor(line.from + target);
  });
  return { selection: EditorSelection.create(ranges, state.selection.mainIndex), moved };
}

function hopMarker(view: EditorView, direction: 1 | -1): boolean {
  const result = hopSelection(view.state, direction);
  if (!result.moved) return false;
  view.dispatch({ selection: result.selection, scrollIntoView: true });
  return true;
}

/** Moves each cursor beyond the next inline Markdown marker run. */
export function hopMarkerForward(view: EditorView): boolean {
  return hopMarker(view, 1);
}

/** Moves each cursor before the previous inline Markdown marker run. */
export function hopMarkerBackward(view: EditorView): boolean {
  return hopMarker(view, -1);
}
