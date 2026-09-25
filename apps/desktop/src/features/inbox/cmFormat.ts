import { EditorSelection, type EditorState, type SelectionRange, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

const WRAP_MARKERS = ["**", "~~", "==", "*", "`", "$"] as const;

export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "numbered"
  | "todo"
  | "todo-checked"
  | "quote"
  | "code"
  | "divider";

const LINE_MARKER_RE = /^(\s*)(?:#{1,6}\s+|>\s+|[-*+]\s+\[[ xX>/-]\]\s+|[-*+]\s+|\d+[.)]\s+)?/;
const INLINE_DELIMITERS_RE = /(\*\*|~~|==|`|\*)/g;

function isEmptyPairAt(state: EditorState, at: number, marker: string): boolean {
  if (at - marker.length < 0 || at + marker.length > state.doc.length) return false;
  return (
    state.sliceDoc(at - marker.length, at) === marker &&
    state.sliceDoc(at, at + marker.length) === marker
  );
}

function longerMarkerPairAt(state: EditorState, at: number, marker: string): boolean {
  return WRAP_MARKERS.some((w) => w.length > marker.length && isEmptyPairAt(state, at, w));
}

function isInsideUnclosedMarker(text: string, marker: string): boolean {
  let count = 0;
  let index = 0;
  while (index < text.length) {
    const found = text.indexOf(marker, index);
    if (found === -1) break;
    if (marker !== "*" || (text[found - 1] !== "*" && text[found + marker.length] !== "*")) {
      count++;
    }
    index = found + marker.length;
  }
  return count % 2 === 1;
}

function emptyLinkBackspaceTransaction(state: EditorState, head: number): TransactionSpec | null {
  const slice = (from: number, to: number): string =>
    state.sliceDoc(Math.max(0, from), Math.min(state.doc.length, to));
  const remove = (from: number, to: number): TransactionSpec => ({
    changes: { from, to, insert: "" },
    selection: EditorSelection.cursor(from)
  });
  if (slice(head - 3, head) === "[](" && slice(head, head + 1) === ")") {
    const bang = slice(head - 4, head - 3) === "!" ? 1 : 0;
    return remove(head - 3 - bang, head + 1);
  }
  if (slice(head - 1, head) === "[" && slice(head, head + 3) === "]()") {
    const bang = slice(head - 2, head - 1) === "!" ? 1 : 0;
    return remove(head - 1 - bang, head + 3);
  }
  return null;
}

/**
 * Removes both sides of an empty formatting marker pair on backspace.
 *
 * @example formatMarkerBackspaceTransaction(view.state)
 */
export function formatMarkerBackspaceTransaction(state: EditorState): TransactionSpec | null {
  const sel = state.selection.main;
  if (!sel.empty) return null;
  const head = sel.head;
  const link = emptyLinkBackspaceTransaction(state, head);
  if (link) return link;
  for (const m of WRAP_MARKERS) {
    if (isEmptyPairAt(state, head, m)) {
      return {
        changes: { from: head - m.length, to: head + m.length, insert: "" },
        selection: EditorSelection.cursor(head - m.length)
      };
    }
  }
  return null;
}

function toggleWrapEmptyAtCursor(
  state: EditorState,
  from: number,
  m: string
): { changes: { from: number; to?: number; insert: string }; range: SelectionRange } {
  const before = state.sliceDoc(Math.max(0, from - m.length), from);
  const after = state.sliceDoc(from, Math.min(state.doc.length, from + m.length));
  if (after === m) {
    if (before === m && !longerMarkerPairAt(state, from, m)) {
      return {
        changes: { from: from - m.length, to: from + m.length, insert: "" },
        range: EditorSelection.cursor(from - m.length)
      };
    }
    const line = state.doc.lineAt(from);
    if (isInsideUnclosedMarker(state.sliceDoc(line.from, from), m)) {
      return { changes: { from, to: from, insert: "" }, range: EditorSelection.cursor(from + m.length) };
    }
  }
  return { changes: { from, insert: m + m }, range: EditorSelection.cursor(from + m.length) };
}

function unwrapExistingMarkers(
  from: number,
  to: number,
  m: string
): { changes: { from: number; to: number; insert: string }[]; range: SelectionRange } {
  return {
    changes: [
      { from: from - m.length, to: from, insert: "" },
      { from: to, to: to + m.length, insert: "" }
    ],
    range: EditorSelection.range(from - m.length, to - m.length)
  };
}

function toggleWrapSelection(
  state: EditorState,
  from: number,
  to: number,
  m: string
): { changes: { from: number; to?: number; insert: string }[]; range: SelectionRange } {
  const before = state.sliceDoc(Math.max(0, from - m.length), from);
  const after = state.sliceDoc(to, Math.min(state.doc.length, to + m.length));
  if (before === m && after === m) {
    return unwrapExistingMarkers(from, to, m);
  }
  const selected = state.sliceDoc(from, to);
  if (selected.length >= m.length * 2 && selected.startsWith(m) && selected.endsWith(m)) {
    return {
      changes: [{ from, to, insert: selected.slice(m.length, selected.length - m.length) }],
      range: EditorSelection.range(from, to - m.length * 2)
    };
  }
  return {
    changes: [
      { from, insert: m },
      { from: to, insert: m }
    ],
    range: EditorSelection.range(from + m.length, to + m.length)
  };
}

/**
 * Toggles a symmetric inline Markdown marker around selections or drops an empty pair.
 *
 * @example toggleWrap(view, "**")
 */
export function toggleWrap(view: EditorView, marker: string): boolean {
  view.dispatch(
    view.state.changeByRange((range) => {
      const { from, to } = range;
      if (from === to) {
        return toggleWrapEmptyAtCursor(view.state, from, marker);
      }
      return toggleWrapSelection(view.state, from, to, marker);
    })
  );
  view.focus();
  return true;
}

function blockPrefix(type: BlockType, index: number): string {
  switch (type) {
    case "h1": return "# ";
    case "h2": return "## ";
    case "h3": return "### ";
    case "bullet": return "- ";
    case "numbered": return `${index + 1}. `;
    case "todo": return "- [ ] ";
    case "todo-checked": return "- [x] ";
    case "quote": return "> ";
    default: return "";
  }
}

function wrapCodeBlock(view: EditorView, firstLineFrom: number, lastLineTo: number): boolean {
  const text = view.state.sliceDoc(firstLineFrom, lastLineTo);
  const insert = "```\n" + text + "\n```";
  view.dispatch({
    changes: { from: firstLineFrom, to: lastLineTo, insert },
    selection: EditorSelection.range(firstLineFrom + 4, firstLineFrom + 4 + text.length)
  });
  view.focus();
  return true;
}

function transformBlockLines(
  state: EditorState,
  firstLineNo: number,
  lastLineNo: number,
  type: BlockType
): { from: number; to: number; insert: string }[] {
  const changes: { from: number; to: number; insert: string }[] = [];
  let index = 0;
  for (let ln = firstLineNo; ln <= lastLineNo; ln++) {
    const line = state.doc.line(ln);
    if (line.text.trim() === "" && type !== "todo" && type !== "bullet" && type !== "h1" && type !== "h2" && type !== "h3") {
      continue;
    }
    const m = line.text.match(LINE_MARKER_RE);
    const indent = m?.[1] ?? "";
    const body = line.text.slice(m?.[0].length ?? 0);
    const next = indent + blockPrefix(type, index) + body;
    index++;
    if (next !== line.text) changes.push({ from: line.from, to: line.to, insert: next });
  }
  return changes;
}

/**
 * Changes lines touched by selection into the specified block type.
 *
 * @example setBlockType(view, "h1")
 */
export function setBlockType(view: EditorView, type: BlockType): boolean {
  const { state } = view;
  const sel = state.selection.main;
  const firstLine = state.doc.lineAt(sel.from);
  const lastLine = state.doc.lineAt(sel.to);
  if (type === "code") {
    return wrapCodeBlock(view, firstLine.from, lastLine.to);
  }
  const changes = transformBlockLines(state, firstLine.number, lastLine.number, type);
  if (changes.length > 0) view.dispatch({ changes });
  view.focus();
  return true;
}

/**
 * Wraps selection in markdown link syntax `[text](url)` or inserts an empty link scaffold.
 *
 * @example wrapLink(view, "https://example.com")
 */
export function wrapLink(view: EditorView, url = ""): boolean {
  view.dispatch(
    view.state.changeByRange((range) => {
      const { from, to } = range;
      const text = view.state.sliceDoc(from, to);
      const insert = `[${text}](${url})`;
      const cursor = url ? from + insert.length : from + 1 + text.length + 1;
      return { changes: { from, to, insert }, range: EditorSelection.cursor(cursor) };
    })
  );
  view.focus();
  return true;
}

/**
 * Inserts a markdown horizontal divider rule `---`.
 *
 * @example insertDivider(view)
 */
export function insertDivider(view: EditorView): boolean {
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.from);
  const insert = line.text.trim() === "" ? "---\n" : "\n---\n";
  view.dispatch({
    changes: { from: line.to, to: line.to, insert },
    selection: EditorSelection.cursor(line.to + insert.length)
  });
  view.focus();
  return true;
}

/**
 * Clears markdown inline formatting and block prefixes from the selection or current line.
 *
 * @example clearFormatting(view)
 */
export function clearFormatting(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (sel.empty) {
    const line = state.doc.lineAt(sel.from);
    const cleaned = line.text.replace(LINE_MARKER_RE, "$1").replace(INLINE_DELIMITERS_RE, "");
    view.dispatch({ changes: { from: line.from, to: line.to, insert: cleaned } });
    return true;
  }
  const text = state.sliceDoc(sel.from, sel.to);
  const cleaned = text.replace(INLINE_DELIMITERS_RE, "");
  view.dispatch({ changes: { from: sel.from, to: sel.to, insert: cleaned } });
  return true;
}
