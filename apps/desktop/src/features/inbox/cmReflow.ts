import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { ChangeSpec, EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

const BREAK_TAGS = ["<br>", "<br/>", "<br />"] as const;

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
  if (mathOpen || isMathBoundary(line.text) || isMathBoundary(next.text)) return null;
  if (hasHardBreak(line.text)) return null;
  const trailing = trailingWhitespaceLength(line.text);
  const leading = continuationPrefixLength(next.text);
  return { from: line.to - trailing, to: next.from + leading };
}

function isMathBoundary(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("$$") || trimmed.endsWith("$$");
}

function hasHardBreak(text: string): boolean {
  if (text.endsWith("\\")) return true;
  if (trailingWhitespaceLength(text) >= 2) return true;
  const lower = text.toLowerCase();
  return BREAK_TAGS.some((tag) => lower.endsWith(tag));
}

function trailingWhitespaceLength(text: string): number {
  let index = text.length;
  while (index > 0 && (text[index - 1] === " " || text[index - 1] === "\t")) index -= 1;
  return text.length - index;
}

function continuationPrefixLength(text: string): number {
  let index = 0;
  while (index < text.length) {
    while (text[index] === " " || text[index] === "\t") index += 1;
    if (text[index] !== ">") break;
    index += 1;
  }
  while (text[index] === " " || text[index] === "\t") index += 1;
  return index;
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
