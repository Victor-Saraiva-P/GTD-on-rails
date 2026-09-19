import { codeFolding, foldEffect, unfoldEffect, foldedRanges, foldService, unfoldAll } from "@codemirror/language";
import { type EditorState, type Extension, type StateEffect, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { Vim } from "@replit/codemirror-vim";

const HEADING_RE = /^\s*(#{1,6})\s+/;
const FENCE_RE = /^\s*(?:`{3,}|~{3,})/;

/**
 * Returns the heading level (1-6) if the line text is a markdown heading, or null.
 *
 * @example parseHeadingLevel("## Title") // 2
 */
export function parseHeadingLevel(text: string): number | null {
  const match = text.match(HEADING_RE);
  return match ? match[1].length : null;
}

/**
 * Checks if line text starts a markdown code fence.
 *
 * @example isCodeFenceLine("```typescript") // true
 */
export function isCodeFenceLine(text: string): boolean {
  return FENCE_RE.test(text);
}

/**
 * Determines whether a given line is located within a fenced code block.
 *
 * @example isLineInsideCodeFence(doc, 5)
 */
export function isLineInsideCodeFence(doc: Text, lineNumber: number): boolean {
  if (isCodeFenceLine(doc.line(lineNumber).text)) return false;
  let fenceCount = 0;
  for (let i = 1; i < lineNumber; i += 1) {
    if (isCodeFenceLine(doc.line(i).text)) {
      fenceCount += 1;
    }
  }
  return fenceCount % 2 === 1;
}

/**
 * Returns the heading level of a document line, ignoring code blocks.
 *
 * @example headingLevelAt(state, 2)
 */
export function headingLevelAt(state: EditorState, lineNumber: number): number | null {
  if (lineNumber < 1 || lineNumber > state.doc.lines) return null;
  const text = state.doc.line(lineNumber).text;
  const level = parseHeadingLevel(text);
  if (level === null) return null;
  if (isLineInsideCodeFence(state.doc, lineNumber)) return null;
  return level;
}

function findSectionEndLine(state: EditorState, headingLine: number, level: number): number {
  const total = state.doc.lines;
  let endLine = total;
  for (let i = headingLine + 1; i <= total; i += 1) {
    const nextLevel = headingLevelAt(state, i);
    if (nextLevel !== null && nextLevel <= level) {
      endLine = i - 1;
      break;
    }
  }
  return endLine;
}

/**
 * Computes the foldable range for a heading line up to the next sibling or parent heading.
 *
 * @example rangeForHeading(state, 1, 1)
 */
export function rangeForHeading(
  state: EditorState,
  headingLine: number,
  level: number
): { from: number; to: number } | null {
  const endLine = findSectionEndLine(state, headingLine, level);
  if (endLine <= headingLine) return null;
  const from = state.doc.line(headingLine).to;
  const to = state.doc.line(endLine).to;
  if (to <= from) return null;
  return { from, to };
}

/**
 * Finds the 1-based line number of the heading that encloses the given line.
 *
 * @example findEnclosingHeadingLine(state, 4)
 */
export function findEnclosingHeadingLine(state: EditorState, lineNumber: number): number | null {
  if (headingLevelAt(state, lineNumber) !== null) return lineNumber;
  const pos = state.doc.line(lineNumber).from;
  for (let i = lineNumber - 1; i >= 1; i -= 1) {
    const level = headingLevelAt(state, i);
    if (level === null) continue;
    const range = rangeForHeading(state, i, level);
    if (range && pos >= range.from && pos <= range.to) {
      return i;
    }
  }
  return null;
}

/**
 * Returns existing folded range matching the target range exactly, or null.
 *
 * @example exactFoldAtRange(state, { from: 10, to: 50 })
 */
export function exactFoldAtRange(
  state: EditorState,
  range: { from: number; to: number }
): { from: number; to: number } | null {
  let existing: { from: number; to: number } | null = null;
  foldedRanges(state).between(range.from, range.to, (from, to) => {
    if (from === range.from && to === range.to) {
      existing = { from, to };
      return false;
    }
    return undefined;
  });
  return existing;
}

/**
 * Checks whether the given range is currently folded.
 *
 * @example isRangeFolded(state, range)
 */
export function isRangeFolded(state: EditorState, range: { from: number; to: number }): boolean {
  return exactFoldAtRange(state, range) !== null;
}

/**
 * Folds the specified heading range in the view.
 *
 * @example foldHeadingRange(view, range)
 */
export function foldHeadingRange(view: EditorView, range: { from: number; to: number }): boolean {
  if (isRangeFolded(view.state, range)) return false;
  view.dispatch({ effects: foldEffect.of(range) });
  return true;
}

/**
 * Unfolds the specified heading range in the view.
 *
 * @example unfoldHeadingRange(view, range)
 */
export function unfoldHeadingRange(view: EditorView, range: { from: number; to: number }): boolean {
  const existing = exactFoldAtRange(view.state, range);
  if (!existing) return false;
  view.dispatch({ effects: unfoldEffect.of(existing) });
  return true;
}

/**
 * Toggles fold state of the specified heading range in the view.
 *
 * @example toggleHeadingRange(view, range)
 */
export function toggleHeadingRange(view: EditorView, range: { from: number; to: number }): boolean {
  if (isRangeFolded(view.state, range)) {
    return unfoldHeadingRange(view, range);
  }
  return foldHeadingRange(view, range);
}

/**
 * Resolves foldable range for the heading at or enclosing the cursor.
 *
 * @example resolveHeadingRangeAtCursor(view)
 */
export function resolveHeadingRangeAtCursor(view: EditorView): { from: number; to: number } | null {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const headingLine = findEnclosingHeadingLine(view.state, line.number);
  if (headingLine === null) return null;
  const level = headingLevelAt(view.state, headingLine);
  if (level === null) return null;
  return rangeForHeading(view.state, headingLine, level);
}

/**
 * Toggles heading fold at or enclosing the current cursor position.
 *
 * @example toggleHeadingAtCursor(view)
 */
export function toggleHeadingAtCursor(view: EditorView): boolean {
  const range = resolveHeadingRangeAtCursor(view);
  return range ? toggleHeadingRange(view, range) : false;
}

/**
 * Folds heading at or enclosing the current cursor position.
 *
 * @example foldHeadingAtCursor(view)
 */
export function foldHeadingAtCursor(view: EditorView): boolean {
  const range = resolveHeadingRangeAtCursor(view);
  return range ? foldHeadingRange(view, range) : false;
}

/**
 * Unfolds heading at or enclosing the current cursor position.
 *
 * @example unfoldHeadingAtCursor(view)
 */
export function unfoldHeadingAtCursor(view: EditorView): boolean {
  const range = resolveHeadingRangeAtCursor(view);
  return range ? unfoldHeadingRange(view, range) : false;
}

/**
 * Toggles heading fold at the specified line number.
 *
 * @example toggleHeadingAtLine(view, 3)
 */
export function toggleHeadingAtLine(view: EditorView, lineNumber: number): boolean {
  const level = headingLevelAt(view.state, lineNumber);
  if (level === null) return false;
  const range = rangeForHeading(view.state, lineNumber, level);
  return range ? toggleHeadingRange(view, range) : false;
}

/**
 * Collects fold effects for all currently unfolded headings in the editor.
 *
 * @example collectFoldAllEffects(state)
 */
export function collectFoldAllEffects(state: EditorState): StateEffect<unknown>[] {
  const effects: StateEffect<unknown>[] = [];
  const total = state.doc.lines;
  for (let i = 1; i <= total; i += 1) {
    const level = headingLevelAt(state, i);
    if (level === null) continue;
    const range = rangeForHeading(state, i, level);
    if (range && !isRangeFolded(state, range)) {
      effects.push(foldEffect.of(range));
    }
  }
  return effects;
}

/**
 * Folds all headings across the entire document.
 *
 * @example foldAllHeadings(view)
 */
export function foldAllHeadings(view: EditorView): boolean {
  const effects = collectFoldAllEffects(view.state);
  if (effects.length === 0) return false;
  view.dispatch({ effects });
  return true;
}

/**
 * Unfolds all folded ranges across the entire document.
 *
 * @example unfoldAllHeadings(view)
 */
export function unfoldAllHeadings(view: EditorView): boolean {
  return unfoldAll(view);
}

export class HeadingFoldArrowWidget extends WidgetType {
  readonly lineNumber: number;
  readonly isFolded: boolean;

  constructor(lineNumber: number, isFolded: boolean) {
    super();
    this.lineNumber = lineNumber;
    this.isFolded = isFolded;
  }

  eq(other: HeadingFoldArrowWidget): boolean {
    return other.lineNumber === this.lineNumber && other.isFolded === this.isFolded;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("span");
    el.className = `cm-heading-fold-arrow ${this.isFolded ? "is-folded" : "is-open"}`;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "-1");
    el.setAttribute("aria-label", this.isFolded ? "Expand heading" : "Collapse heading");
    el.setAttribute("aria-expanded", String(!this.isFolded));
    el.textContent = this.isFolded ? "▸" : "▾";
    const swallow = (e: Event): void => { e.preventDefault(); e.stopPropagation(); };
    el.addEventListener("mousedown", swallow);
    el.addEventListener("pointerdown", swallow);
    el.addEventListener("click", (e: Event) => {
      swallow(e);
      toggleHeadingAtLine(view, this.lineNumber);
    });
    return el;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function createHeadingDecorations(
  state: EditorState,
  lineNumber: number,
  level: number
): { lineDeco: Decoration; widgetDeco: Decoration; pos: number } | null {
  const range = rangeForHeading(state, lineNumber, level);
  if (!range) return null;
  const line = state.doc.line(lineNumber);
  const isFolded = isRangeFolded(state, range);
  const classes = ["cm-heading-line", `cm-heading-line-h${level}`];
  if (isFolded) classes.push("cm-heading-line-folded");
  return {
    pos: line.from,
    lineDeco: Decoration.line({ class: classes.join(" ") }),
    widgetDeco: Decoration.widget({ side: -1, widget: new HeadingFoldArrowWidget(lineNumber, isFolded) })
  };
}

/**
 * Builds heading fold line and arrow decorations for the current visible ranges.
 *
 * @example buildHeadingFoldDecorations(view)
 */
export function buildHeadingFoldDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const items: { from: number; to: number; deco: Decoration }[] = [];
  for (const { from, to } of view.visibleRanges) {
    const first = state.doc.lineAt(from).number;
    const last = state.doc.lineAt(Math.max(from, to - 1)).number;
    for (let n = first; n <= last; n += 1) {
      const level = headingLevelAt(state, n);
      if (level === null) continue;
      const decos = createHeadingDecorations(state, n, level);
      if (!decos) continue;
      items.push({ from: decos.pos, to: decos.pos, deco: decos.lineDeco });
      items.push({ from: decos.pos, to: decos.pos, deco: decos.widgetDeco });
    }
  }
  return Decoration.set(items.map((i) => i.deco.range(i.from, i.to)), true);
}

function headingArrowPlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildHeadingFoldDecorations(view);
      }
      update(update: ViewUpdate): void {
        const hasFoldChange = update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect))
        );
        if (update.docChanged || update.viewportChanged || hasFoldChange) {
          this.decorations = buildHeadingFoldDecorations(update.view);
        }
      }
    },
    { decorations: (p) => p.decorations }
  );
}

/**
 * CodeMirror 6 extension providing markdown heading folding and fold indicator arrows.
 *
 * @example headingFoldingExtension()
 */
export function headingFoldingExtension(): Extension {
  const service = foldService.of((state, lineStart) => {
    const lineNumber = state.doc.lineAt(lineStart).number;
    const level = headingLevelAt(state, lineNumber);
    if (level === null) return null;
    return rangeForHeading(state, lineNumber, level);
  });
  return [codeFolding(), service, headingArrowPlugin()];
}

let headingFoldVimRegistered = false;

function mapHeadingFoldCommands(): void {
  const ctx = { context: "normal" } as const;
  Vim.mapCommand("za", "action", "gtdToggleHeadingFold", {}, ctx);
  Vim.mapCommand("zc", "action", "gtdFoldHeading", {}, ctx);
  Vim.mapCommand("zo", "action", "gtdUnfoldHeading", {}, ctx);
  Vim.mapCommand("zM", "action", "gtdFoldAllHeadings", {}, ctx);
  Vim.mapCommand("zR", "action", "gtdUnfoldAllHeadings", {}, ctx);
}

function defineHeadingFoldActions(): void {
  Vim.defineAction("gtdToggleHeadingFold", (cm: { cm6?: EditorView }) => { if (cm.cm6) toggleHeadingAtCursor(cm.cm6); });
  Vim.defineAction("gtdFoldHeading", (cm: { cm6?: EditorView }) => { if (cm.cm6) foldHeadingAtCursor(cm.cm6); });
  Vim.defineAction("gtdUnfoldHeading", (cm: { cm6?: EditorView }) => { if (cm.cm6) unfoldHeadingAtCursor(cm.cm6); });
  Vim.defineAction("gtdFoldAllHeadings", (cm: { cm6?: EditorView }) => { if (cm.cm6) foldAllHeadings(cm.cm6); });
  Vim.defineAction("gtdUnfoldAllHeadings", (cm: { cm6?: EditorView }) => { if (cm.cm6) unfoldAllHeadings(cm.cm6); });
}

function defineHeadingFoldExCommands(): void {
  Vim.defineEx("fold", "fold", (cm: { cm6?: EditorView }) => { if (cm.cm6) foldHeadingAtCursor(cm.cm6); });
  Vim.defineEx("unfold", "unfold", (cm: { cm6?: EditorView }) => { if (cm.cm6) unfoldHeadingAtCursor(cm.cm6); });
  Vim.defineEx("foldall", "foldall", (cm: { cm6?: EditorView }) => { if (cm.cm6) foldAllHeadings(cm.cm6); });
  Vim.defineEx("unfoldall", "unfoldall", (cm: { cm6?: EditorView }) => { if (cm.cm6) unfoldAllHeadings(cm.cm6); });
}

/**
 * Registers Vim actions, normal mode mappings (za, zc, zo, zM, zR), and ex commands (:fold, :unfold, etc.).
 *
 * @example registerHeadingFoldVimCommands()
 */
export function registerHeadingFoldVimCommands(): void {
  if (headingFoldVimRegistered) return;
  headingFoldVimRegistered = true;
  defineHeadingFoldActions();
  mapHeadingFoldCommands();
  defineHeadingFoldExCommands();
}
