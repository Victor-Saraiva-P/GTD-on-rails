import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { ChangeSpec, EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

const HARD_BREAK_RE = /(?: {2,}|\\|<br\s*\/?>)$/i;
const MATH_BOUNDARY_RE = /^\s*\$\$|\$\$\s*$/;
const CONTINUATION_PREFIX_RE = /^[ \t]*(?:>[ \t]*)*/;

type Join = { from: number; to: number };

function paragraphJoins(
  state: EditorState,
  paragraphFrom: number,
  paragraphTo: number
): Join[] {
  const joins: Join[] = [];
  const first = state.doc.lineAt(paragraphFrom).number;
  const last = state.doc.lineAt(paragraphTo).number;
  let mathOpen = false;
  for (let lineNumber = first; lineNumber < last; lineNumber += 1) {
    const join = joinForLine(state, lineNumber, mathOpen);
    mathOpen = nextMathState(state.doc.line(lineNumber).text, mathOpen);
    if (join) joins.push(join);
  }
  return joins;
}

function nextMathState(text: string, open: boolean): boolean {
  const count = text.split("$$").length - 1;
  return count % 2 === 1 ? !open : open;
}

function joinForLine(state: EditorState, lineNumber: number, mathOpen: boolean): Join | null {
  const line = state.doc.line(lineNumber);
  const next = state.doc.line(lineNumber + 1);
  if (mathOpen || MATH_BOUNDARY_RE.test(line.text) || MATH_BOUNDARY_RE.test(next.text)) return null;
  if (HARD_BREAK_RE.test(line.text)) return null;
  const trailing = line.text.length - line.text.replace(/[ \t]+$/, "").length;
  const leading = next.text.match(CONTINUATION_PREFIX_RE)?.[0].length ?? 0;
  return { from: line.to - trailing, to: next.from + leading };
}

/**
 * Computes newline replacements for Markdown paragraphs touched by the range.
 *
 * @example reflowChanges(state, 0, 4)
 */
export function reflowChanges(state: EditorState, from: number, to: number): ChangeSpec[] {
  const tree = ensureSyntaxTree(state, Math.min(state.doc.length, to + 1), 200) ?? syntaxTree(state);
  const joins: Join[] = [];
  tree.iterate({
    from,
    to,
    enter: (node) => collectParagraphNode(state, node, joins)
  });
  return joins.map((join) => ({ from: join.from, to: join.to, insert: " " }));
}

function collectParagraphNode(
  state: EditorState,
  node: { name: string; from: number; to: number },
  joins: Join[]
): boolean | undefined {
  if (node.name !== "Paragraph") return undefined;
  joins.push(...paragraphJoins(state, node.from, node.to));
  return false;
}

/**
 * Joins hard-wrapped lines in the current Markdown paragraph or selected paragraphs.
 */
export function reflowParagraph(view: EditorView): boolean {
  const selection = view.state.selection.main;
  const from = view.state.doc.lineAt(selection.from).from;
  const to = view.state.doc.lineAt(selection.to).to;
  const changes = reflowChanges(view.state, from, to);
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: "format.reflow" });
  return true;
}
