import { type Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { CodeMirror, Vim } from "@replit/codemirror-vim";

const HEADING_REGEX = /^\s*#{1,6}\s+/;

/**
 * Checks whether the given line text represents a markdown heading.
 *
 * @example isHeadingLineText("# Section")
 */
export function isHeadingLineText(text: string): boolean {
  return HEADING_REGEX.test(text);
}

/**
 * Finds the 1-based target line of the next or previous markdown heading.
 *
 * @example findNextHeadingLine(doc, 1, true, 1)
 */
export function findNextHeadingLine(
  doc: Text,
  fromLine: number,
  forward: boolean,
  repeat: number = 1
): number | null {
  let count = Math.max(1, repeat);
  const total = doc.lines;
  let current = fromLine;

  while (forward ? current < total : current > 1) {
    current += forward ? 1 : -1;
    if (isHeadingLineText(doc.line(current).text)) {
      count -= 1;
      if (count === 0) return current;
    }
  }
  return null;
}

interface VimHeadingAdapter {
  cm6?: EditorView;
  firstLine: () => number;
  lastLine: () => number;
}

/**
 * Motion function for CodeMirror Vim that jumps to the next or previous heading.
 *
 * @example moveToHeadingMotion(cm, head, { forward: true })
 */
export function moveToHeadingMotion(
  cm: VimHeadingAdapter,
  head: { line: number; ch: number },
  motionArgs: { forward?: boolean; repeat?: number }
): { line: number; ch: number } {
  const view = cm.cm6;
  if (!view) return new CodeMirror.Pos(head.line, head.ch);
  const currentLine = head.line + 1;
  const forward = Boolean(motionArgs.forward);
  const target = findNextHeadingLine(view.state.doc, currentLine, forward, motionArgs.repeat);
  if (target !== null) {
    return new CodeMirror.Pos(target - 1, 0);
  }
  const fallback = forward ? cm.lastLine() : cm.firstLine();
  return new CodeMirror.Pos(fallback, 0);
}

let headingsRegistered = false;

/**
 * Registers `]]` and `[[` markdown heading motions in CodeMirror Vim.
 *
 * @example registerHeadingMotions()
 */
export function registerHeadingMotions(): void {
  if (headingsRegistered) return;
  headingsRegistered = true;
  Vim.defineMotion("zenMoveToHeading", moveToHeadingMotion as never);
  const contexts = ["normal", "visual", "operatorPending"] as const;
  for (const context of contexts) {
    Vim.mapCommand("]]", "motion", "zenMoveToHeading", { forward: true, toJumplist: true }, { context });
    Vim.mapCommand("[[", "motion", "zenMoveToHeading", { forward: false, toJumplist: true }, { context });
  }
}
