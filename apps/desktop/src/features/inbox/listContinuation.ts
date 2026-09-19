import type { EditorView } from "@codemirror/view";
import { Vim } from "@replit/codemirror-vim";

const LIST_PREFIX_RE = /^([ \t]*)(?:([-+*])|(\d{1,9})([.)]))[ \t]+(\[[ xX>/-]\][ \t]+)?/;
const EMPTY_LIST_RE = /^[ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]*(?:\[[ xX>/-]\][ \t]*)?$/;

/**
 * Computes the continuation prefix for the next list item.
 *
 * @example listContinuationPrefix("- [x] done") // "- [ ] "
 */
export function listContinuationPrefix(lineText: string): string | null {
  const match = lineText.match(LIST_PREFIX_RE);
  if (!match) return null;
  const [, indent, bullet, orderedNumber, orderedDelimiter, checkbox] = match;
  const marker = bullet ?? `${Number.parseInt(orderedNumber, 10) + 1}${orderedDelimiter}`;
  return `${indent}${marker} ${checkbox ? "[ ] " : ""}`;
}

/**
 * Checks whether a line contains only an empty list or task marker.
 *
 * @example isEmptyListLine("- [ ] ") // true
 */
export function isEmptyListLine(lineText: string): boolean {
  return EMPTY_LIST_RE.test(lineText);
}

function clearEmptyListMarker(view: EditorView, lineFrom: number, lineTo: number): void {
  view.dispatch({
    changes: { from: lineFrom, to: lineTo, insert: "" },
    selection: { anchor: lineFrom },
    userEvent: "input"
  });
}

function insertContinuedListPrefix(view: EditorView, pos: number, prefix: string): void {
  const insert = `\n${prefix}`;
  view.dispatch({
    changes: { from: pos, insert },
    selection: { anchor: pos + insert.length },
    userEvent: "input"
  });
}

/**
 * Handles Enter in insert mode: continues list markers or clears empty list items.
 *
 * @example handleListContinuationEnter(view)
 */
export function handleListContinuationEnter(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (!sel.empty) return false;
  const line = view.state.doc.lineAt(sel.head);

  if (isEmptyListLine(line.text)) {
    clearEmptyListMarker(view, line.from, line.to);
    return true;
  }

  const prefix = listContinuationPrefix(line.text);
  if (!prefix) return false;

  insertContinuedListPrefix(view, sel.head, prefix);
  return true;
}

interface VimActionCaller {
  newLineAndEnterInsertMode: (cm: unknown, args: unknown, vim: unknown) => void;
  enterInsertMode: (cm: unknown, args: unknown, vim: unknown) => void;
}

function dispatchOpenContinuingLine(
  view: EditorView,
  line: { from: number; to: number },
  prefix: string,
  after: boolean
): void {
  if (after) {
    view.dispatch({
      changes: { from: line.to, insert: `\n${prefix}` },
      selection: { anchor: line.to + 1 + prefix.length }
    });
    return;
  }
  view.dispatch({
    changes: { from: line.from, insert: `${prefix}\n` },
    selection: { anchor: line.from + prefix.length }
  });
}

function openContinuingLineAction(
  this: VimActionCaller,
  cm: unknown,
  actionArgs: { after?: boolean; repeat?: number },
  vim: { insertMode?: boolean }
): void {
  const view = (cm as { cm6?: EditorView }).cm6;
  const head = view?.state.selection.main.head;
  const prefix = view && head !== undefined ? listContinuationPrefix(view.state.doc.lineAt(head).text) : null;

  if (!view || prefix === null || head === undefined) {
    this.newLineAndEnterInsertMode(cm, actionArgs, vim);
    return;
  }

  const line = view.state.doc.lineAt(head);
  vim.insertMode = true;
  dispatchOpenContinuingLine(view, line, prefix, Boolean(actionArgs.after));
  this.enterInsertMode(cm, { repeat: actionArgs.repeat }, vim);
}

let listContinuationRegistered = false;

/**
 * Registers Vim `o` and `O` commands to automatically continue list prefixes.
 *
 * @example registerListContinuationMotions()
 */
export function registerListContinuationMotions(): void {
  if (listContinuationRegistered) return;
  listContinuationRegistered = true;

  Vim.defineAction("gtdOpenLineContinuingList", openContinuingLineAction as never);
  Vim.mapCommand(
    "o",
    "action",
    "gtdOpenLineContinuingList",
    { after: true },
    { context: "normal", isEdit: true, interlaceInsertRepeat: true }
  );
  Vim.mapCommand(
    "O",
    "action",
    "gtdOpenLineContinuingList",
    { after: false },
    { context: "normal", isEdit: true, interlaceInsertRepeat: true }
  );
}
