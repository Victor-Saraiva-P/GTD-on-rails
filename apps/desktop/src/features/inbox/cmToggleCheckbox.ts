import type { ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { Vim } from "@replit/codemirror-vim";

const LINE_PREFIX_RE = /^([ \t]*(?:>[ \t]?)*)/;
const LIST_MARKER_RE = /^([-*+]|\d{1,9}[.)])([ \t]+)/;
const TASK_STATE_RE = /^\[(.)\](?:[ \t]|$)/;

function toggleExistingTaskState(
  stateChar: string,
  from: number,
  markerEnd: number
): ChangeSpec | null {
  if (stateChar === ">" || stateChar === "-") return null;
  const at = from + markerEnd + 1;
  return { from: at, to: at + 1, insert: /[xX]/.test(stateChar) ? " " : "x" };
}

function toggleListMarkerLine(
  line: string,
  from: number,
  prefixLen: number,
  marker: RegExpExecArray
): ChangeSpec | null {
  const markerEnd = prefixLen + marker[0].length;
  const state = TASK_STATE_RE.exec(line.slice(markerEnd));
  if (state) {
    return toggleExistingTaskState(state[1], from, markerEnd);
  }
  return { from: from + markerEnd, insert: "[ ] " };
}

/**
 * Computes minimal change to toggle a checkbox on a line of text.
 *
 * @example checkboxToggleChange("- [ ] task", 0) // { from: 3, to: 4, insert: "x" }
 */
export function checkboxToggleChange(line: string, from: number): ChangeSpec | null {
  const prefixMatch = LINE_PREFIX_RE.exec(line);
  const prefixLen = prefixMatch ? prefixMatch[1].length : 0;
  const afterPrefix = line.slice(prefixLen);

  const marker = LIST_MARKER_RE.exec(afterPrefix);
  if (marker) {
    return toggleListMarkerLine(line, from, prefixLen, marker);
  }

  return { from: from + prefixLen, insert: "- [ ] " };
}

function collectLineIndices(view: EditorView): number[] {
  const seen = new Set<number>();
  const lineIndices: number[] = [];
  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n += 1) {
      if (!seen.has(n)) {
        seen.add(n);
        lineIndices.push(n);
      }
    }
  }
  return lineIndices;
}

/**
 * Toggles checkbox on all lines touched by current editor selection.
 *
 * @example toggleCheckbox(view)
 */
export function toggleCheckbox(view: EditorView): boolean {
  const lineIndices = collectLineIndices(view);
  const changes: ChangeSpec[] = [];
  for (const n of lineIndices) {
    const line = view.state.doc.line(n);
    const change = checkboxToggleChange(line.text, line.from);
    if (change) changes.push(change);
  }
  if (changes.length > 0) {
    view.dispatch({ changes, userEvent: "input" });
  }
  return true;
}

let checkboxVimRegistered = false;

/**
 * Registers Vim commands for toggling checkboxes.
 *
 * @example registerCheckboxVimCommands()
 */
export function registerCheckboxVimCommands(): void {
  if (checkboxVimRegistered) return;
  checkboxVimRegistered = true;

  Vim.defineAction("gtdToggleCheckbox", (cm: { cm6?: EditorView }) => {
    if (cm.cm6) toggleCheckbox(cm.cm6);
  });

  Vim.mapCommand("<C-CR>", "action", "gtdToggleCheckbox", {}, { context: "normal" });
  Vim.mapCommand("<C-CR>", "action", "gtdToggleCheckbox", {}, { context: "insert" });
}
