import { syntaxTree } from "@codemirror/language";
import { Facet, RangeSetBuilder, StateEffect, type EditorState } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { getCM } from "@replit/codemirror-vim";

export const refreshLivePreviewEffect = StateEffect.define<void>();
export const itemDocumentIdFacet = Facet.define<string, string>({ combine: (values) => values[0] ?? "" });
import {
  BulletMarkWidget,
  DividerWidget,
  LiveAttachmentWidget,
  LiveImageWidget,
  LivePdfWidget,
  TaskCheckboxWidget
} from "./cmLivePreviewWidgets.ts";
import { itemBodyStateField } from "./itemBodyUtils.ts";
import type { BlockEntity } from "./types.ts";

const hide = Decoration.replace({});
const imageSourceHide = Decoration.replace({});
const imageEmbedLine = Decoration.line({ class: "cm-image-embed-line" });
const taskDoneMark = Decoration.mark({ class: "cm-task-done cm-checklist-text--checked" });
const boldMark = Decoration.mark({ class: "cm-bold-text" });
const italicMark = Decoration.mark({ class: "cm-italic-text" });
const codeMark = Decoration.mark({ class: "cm-code-text" });
const linkMark = Decoration.mark({ class: "cm-markdown-link" });
const quoteLine = Decoration.line({ class: "cm-quote-line" });

const SIMPLE_HIDE_NODES = new Set(["EmphasisMark", "CodeMark", "LinkMark", "StrikethroughMark"]);
const PREFIX_HIDE_NODES = new Set(["HeaderMark", "QuoteMark"]);

const STANDALONE_IMAGE_RE = /^\s*!\[([^\]]*)\]\((?:<([^>]+)>|([^)]+?))\s*\)\s*$/;
const STANDALONE_LINK_RE = /^\s*\[([^\]]+)\]\((?:<([^>]+)>|([^)]+?))\s*\)\s*$/;
const ASSET_TOKEN_RE = /(\[\[asset:([0-9a-fA-F-]{36})]]|\[asset:([0-9a-fA-F-]{36})]|⟦asset:([0-9a-fA-F-]{36})⟧)/;

type PendingDeco = { from: number; to: number; deco: Decoration };

/**
 * Checks whether the editor is in Vim insert mode or standard editing.
 *
 * @example isEditorInInsertMode(view)
 */
export function isEditorInInsertMode(view: EditorView): boolean {
  const cm = getCM(view);
  if (!cm) return true;
  return cm.state?.vim?.insertMode === true;
}

/**
 * Computes active line numbers that expand raw markdown syntax in insert mode.
 *
 * @example computeActiveLines(view.state, true)
 */
export function computeActiveLines(state: EditorState, inInsertMode = true): Set<number> {
  if (!inInsertMode) return new Set<number>();
  const active = new Set<number>();
  for (const range of state.selection.ranges) {
    const start = state.doc.lineAt(range.from).number;
    const end = state.doc.lineAt(range.to).number;
    for (let i = start; i <= end; i++) active.add(i);
  }
  return active;
}

function headingClassForLevel(name: string): string | null {
  if (name === "ATXHeading1") return "cm-md-heading-1";
  if (name === "ATXHeading2") return "cm-md-heading-2";
  if (name === "ATXHeading3") return "cm-md-heading-3";
  return null;
}

function collectTaskMarkerDeco(
  state: EditorState,
  from: number,
  to: number,
  pending: PendingDeco[]
): void {
  const line = state.doc.lineAt(from);
  const text = state.sliceDoc(from, to);
  const checked = /[xX]/.test(text[1] ?? "");
  if (checked && line.to > to) {
    pending.push({ from: to, to: line.to, deco: taskDoneMark });
  }
  pending.push({ from, to, deco: Decoration.replace({ widget: new TaskCheckboxWidget(from, checked) }) });
}

function collectListMarkDeco(
  state: EditorState,
  from: number,
  to: number,
  pending: PendingDeco[]
): void {
  const markText = state.sliceDoc(from, to);
  if (!/^[-*+]$/.test(markText)) return;
  const line = state.doc.lineAt(from);
  if (/^\s*[-*+]\s+\[[ xX>/-]\]/.test(line.text)) return;
  const indent = from - line.from;
  const level = Math.floor(indent / 2) % 3;
  const end = to + (state.sliceDoc(to, to + 1) === " " ? 1 : 0);
  pending.push({ from: line.from, to: line.from, deco: Decoration.line({ class: "cm-bullet-line" }) });
  pending.push({ from, to: end, deco: Decoration.replace({ widget: new BulletMarkWidget(level) }) });
}

function collectSyntaxNodeDecos(
  state: EditorState,
  node: { name: string; from: number; to: number; node: { parent?: { name?: string } | null } },
  activeLines: Set<number>,
  pending: PendingDeco[]
): void {
  const line = state.doc.lineAt(node.from).number;
  if (node.name === "TaskMarker") {
    return collectTaskMarkerDeco(state, node.from, node.to, pending);
  }
  if (node.name === "ListMark") {
    return collectListMarkDeco(state, node.from, node.to, pending);
  }
  if (node.name === "HorizontalRule" && !activeLines.has(line)) {
    const lineObj = state.doc.lineAt(node.from);
    pending.push({ from: lineObj.from, to: lineObj.to, deco: Decoration.replace({ widget: new DividerWidget() }) });
    return;
  }
  applySyntaxMarks(state, node, activeLines, pending, line);
}

function applySyntaxMarks(
  state: EditorState,
  node: { name: string; from: number; to: number },
  activeLines: Set<number>,
  pending: PendingDeco[],
  line: number
): void {
  const isPrefix = PREFIX_HIDE_NODES.has(node.name);
  const isSimple = SIMPLE_HIDE_NODES.has(node.name);
  if ((isPrefix || isSimple) && !activeLines.has(line)) {
    let end = node.to;
    if (isPrefix && (state.doc.sliceString(end, end + 1) === " " || state.doc.sliceString(end, end + 1) === "\t")) {
      end += 1;
    }
    pending.push({ from: node.from, to: end, deco: hide });
  }
  applySemanticMarks(node, pending);
}

function applySemanticMarks(
  node: { name: string; from: number; to: number },
  pending: PendingDeco[]
): void {
  if (node.name === "StrongEmphasis") pending.push({ from: node.from, to: node.to, deco: boldMark });
  if (node.name === "Emphasis") pending.push({ from: node.from, to: node.to, deco: italicMark });
  if (node.name === "InlineCode") pending.push({ from: node.from, to: node.to, deco: codeMark });
  if (node.name === "Link") pending.push({ from: node.from, to: node.to, deco: linkMark });
  if (node.name === "Blockquote") pending.push({ from: node.from, to: node.from, deco: quoteLine });
  const headingCls = headingClassForLevel(node.name);
  if (headingCls) pending.push({ from: node.from, to: node.from, deco: Decoration.line({ class: headingCls }) });
}

function findAssetEntity(entities: BlockEntity[], id: string): BlockEntity | undefined {
  return entities.find((e) => e.assetId === id || e.id === id);
}

function createAssetWidget(entity: BlockEntity, lineFrom: number): Decoration {
  const isImg = entity.type === "image" || entity.attrs?.contentType?.startsWith("image/") === true;
  if (isImg) {
    return Decoration.widget({
      side: 1,
      widget: new LiveImageWidget(entity.attrs?.displayName || "Image", entity.attrs?.url || "", lineFrom, entity)
    });
  }
  const isPdf = entity.attrs?.contentType === "application/pdf" || entity.attrs?.url?.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    return Decoration.widget({
      side: 1,
      widget: new LivePdfWidget(entity.attrs?.displayName || "PDF", entity, entity.attrs?.url)
    });
  }
  return Decoration.widget({
    side: 1,
    widget: new LiveAttachmentWidget(entity.attrs?.displayName || "Attachment", entity.attrs?.url || "", entity)
  });
}

function processAssetLine(
  state: EditorState,
  line: { from: number; to: number; number: number; text: string },
  entities: BlockEntity[],
  lineActive: boolean,
  pending: PendingDeco[]
): boolean {
  const assetMatch = line.text.match(ASSET_TOKEN_RE);
  if (!assetMatch) return false;
  const assetId = assetMatch[2] ?? assetMatch[3] ?? assetMatch[4];
  const entity = findAssetEntity(entities, assetId);
  if (!entity) return false;
  pending.push({ from: line.to, to: line.to, deco: createAssetWidget(entity, line.from) });
  if (!lineActive) {
    pending.push({ from: line.from, to: line.to, deco: imageSourceHide });
    pending.push({ from: line.from, to: line.from, deco: imageEmbedLine });
  }
  return true;
}

function processMarkdownImageLine(
  state: EditorState,
  line: { from: number; to: number; text: string },
  lineActive: boolean,
  pending: PendingDeco[]
): boolean {
  const match = line.text.match(STANDALONE_IMAGE_RE);
  if (!match) return false;
  const alt = match[1] ?? "";
  const href = (match[2] ?? match[3] ?? "").trim();
  const entity = markdownAssetEntity(state, href, alt, "image");
  pending.push({
    from: line.to, to: line.to,
    deco: Decoration.widget({ side: 1, widget: new LiveImageWidget(alt, href, line.from, entity) })
  });
  hideStandaloneSource(line, lineActive, pending);
  return true;
}

function processMarkdownPdfLine(
  state: EditorState,
  line: { from: number; to: number; text: string },
  lineActive: boolean,
  pending: PendingDeco[]
): boolean {
  const match = line.text.match(STANDALONE_LINK_RE);
  if (!match) return false;
  const displayName = match[1] ?? "PDF";
  const href = (match[2] ?? match[3] ?? "").trim();
  if (!href.toLowerCase().endsWith(".pdf")) return false;
  const entity = markdownAssetEntity(state, href, displayName, "pdf");
  if (!entity) return false;
  pending.push({
    from: line.to, to: line.to,
    deco: Decoration.widget({ side: 1, widget: new LivePdfWidget(displayName, entity) })
  });
  hideStandaloneSource(line, lineActive, pending);
  return true;
}

function hideStandaloneSource(
  line: { from: number; to: number },
  lineActive: boolean,
  pending: PendingDeco[]
): void {
  if (lineActive) return;
  pending.push({ from: line.from, to: line.to, deco: imageSourceHide });
  pending.push({ from: line.from, to: line.from, deco: imageEmbedLine });
}

function markdownAssetEntity(
  state: EditorState,
  href: string,
  displayName: string,
  type: "image" | "pdf"
): BlockEntity | undefined {
  if (!href.startsWith("assets/")) return undefined;
  const itemId = state.facet(itemDocumentIdFacet);
  if (!itemId) return undefined;
  const decodedHref = decodeURIComponent(href);
  const assetId = decodedHref.split("/")[1] ?? href;
  return {
    id: `markdown-${assetId}`, type, from: 0, to: 0, assetId,
    attrs: {
      displayName,
      contentType: type === "image" ? imageContentType(decodedHref) : "application/pdf",
      relativePath: `items/${itemId}/${decodedHref}`
    }
  };
}

function imageContentType(path: string): string {
  if (path.toLowerCase().endsWith(".svg")) return "image/svg+xml";
  if (path.toLowerCase().endsWith(".webp")) return "image/webp";
  if (path.toLowerCase().endsWith(".gif")) return "image/gif";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  return "image/png";
}

function collectLineAssetDecos(
  state: EditorState,
  visibleRanges: readonly { from: number; to: number }[],
  activeLines: Set<number>,
  entities: BlockEntity[],
  pending: PendingDeco[]
): Set<number> {
  const replacedLines = new Set<number>();
  for (const { from, to } of visibleRanges) {
    const firstLine = state.doc.lineAt(from).number;
    const lastLine = state.doc.lineAt(Math.min(to, state.doc.length)).number;
    for (let ln = firstLine; ln <= lastLine; ln++) {
      const line = state.doc.line(ln);
      const lineActive = activeLines.has(ln);
      if (processAssetLine(state, line, entities, lineActive, pending) || processMarkdownImageLine(state, line, lineActive, pending) || processMarkdownPdfLine(state, line, lineActive, pending)) {
        replacedLines.add(ln);
      }
    }
  }
  return replacedLines;
}

/**
 * Builds all live preview decorations for visible editor ranges.
 *
 * @example buildLivePreviewDecorations(view)
 */
export function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const inInsertMode = isEditorInInsertMode(view);
  const activeLines = computeActiveLines(state, inInsertMode);
  const entities = state.field(itemBodyStateField, false)?.blockEntities ?? [];
  const pending: PendingDeco[] = [];

  const replacedLines = collectLineAssetDecos(state, view.visibleRanges, activeLines, entities, pending);

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const line = state.doc.lineAt(node.from).number;
        if (replacedLines.has(line)) return;
        collectSyntaxNodeDecos(state, node, activeLines, pending);
      }
    });
  }

  return buildSortedDecorationSet(pending);
}

function buildSortedDecorationSet(pending: PendingDeco[]): DecorationSet {
  pending.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    const isLineA = a.deco.spec.line ? 1 : 0;
    const isLineB = b.deco.spec.line ? 1 : 0;
    if (isLineA !== isLineB) return isLineB - isLineA;
    return a.to - b.to;
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const item of pending) {
    if (item.from <= item.to) {
      try {
        builder.add(item.from, item.to, item.deco);
      } catch {
        // Safe skip for overlapping boundary decorations
      }
    }
  }
  return builder.finish();
}

/**
 * ViewPlugin providing Obsidian/Zennotes-style Live Preview in CodeMirror.
 */
export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLivePreviewDecorations(view);
    }

    update(update: ViewUpdate): void {
      const hasRefresh = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(refreshLivePreviewEffect))
      );
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state) ||
        hasRefresh
      ) {
        this.decorations = buildLivePreviewDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
);
