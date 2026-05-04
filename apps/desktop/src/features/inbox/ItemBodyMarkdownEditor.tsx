import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { Decoration, drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers, ViewPlugin, WidgetType, type ViewUpdate, type DecorationSet } from "@codemirror/view";
import { getCM, Vim, vim, type CodeMirrorV } from "@replit/codemirror-vim";
import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import {
  createSaveItemBodyCommand,
  normalizeMarkdownBody,
  saveNormalizedMarkdownBody,
  runPostSaveEffects,
  type MarkdownBodySaveState
} from "./bodyMarkdown";

export type ItemBodyMarkdownEditorProps = {
  itemId: string;
  initialBody?: string | null;
  readOnly?: boolean;
  onAutosave?: (body: string) => Promise<void>;
  onSave?: (body: string) => Promise<void>;
  onExitNormalMode?: (body: string) => Promise<void>;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
};

export const FORMAT_BULLET_EVENT = "gtd:format-bullet";
export const FORMAT_HEADING_EVENT = "gtd:format-heading";
export const FORMAT_NUMBERED_LIST_EVENT = "gtd:format-numbered-list";
export const FORMAT_NORMAL_TEXT_EVENT = "gtd:format-normal-text";
export const FORMAT_LETTERED_LIST_EVENT = "gtd:format-lettered-list";
export const FORMAT_CHECKLIST_EVENT = "gtd:format-checklist";
export const FORMAT_CHECKLIST_CHECKED_EVENT = "gtd:format-checklist-checked";
export const FORMAT_CHECKLIST_UNCHECKED_EVENT = "gtd:format-checklist-unchecked";

type ItemBodyMarkdownEditorFrameProps = {
  editorParentRef: RefObject<HTMLDivElement | null>;
};

type AutosaveTracker = {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastInsertExitAt: number | null;
  lastInsertMode: boolean | null;
  changeId: number;
};

function normalizedInitialBody(initialBody: string | null | undefined): string {
  try {
    return normalizeMarkdownBody(initialBody);
  } catch {
    return "";
  }
}

function ItemBodyMarkdownEditorFrame(props: ItemBodyMarkdownEditorFrameProps) {
  return (
    <div className="inbox-detail__markdown-editor">
      <div ref={props.editorParentRef} className="inbox-detail__codemirror" />
    </div>
  );
}

/**
 * Mounts a CodeMirror Markdown editor for one GTD item body.
 *
 * @example <ItemBodyMarkdownEditor itemId={item.id} initialBody={item.body} onSave={saveBody} />
 */
export function ItemBodyMarkdownEditor(props: ItemBodyMarkdownEditorProps) {
  const editorParentRef = useRef<HTMLDivElement | null>(null);
  const [, setSaveState] = useState<MarkdownBodySaveState>("saved");
  const onAutosaveRef = useLatestCallbackRef(props.onAutosave);
  const onSaveRef = useLatestCallbackRef(props.onSave);
  const onExitNormalModeRef = useLatestCallbackRef(props.onExitNormalMode);
  const onVimModeChangeRef = useLatestCallbackRef(props.onVimModeChange);
  const autosaveTrackerRef = useRef<AutosaveTracker>({
    hasUnsavedChanges: false,
    isSaving: false,
    lastInsertExitAt: null,
    lastInsertMode: null,
    changeId: 0
  });

  useCodeMirrorEditorView(
    editorParentRef,
    props,
    autosaveTrackerRef,
    onAutosaveRef,
    onSaveRef,
    onExitNormalModeRef,
    onVimModeChangeRef,
    setSaveState
  );

  return <ItemBodyMarkdownEditorFrame editorParentRef={editorParentRef} />;
}

function useLatestCallbackRef<T>(callback: T) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return callbackRef;
}

function useCodeMirrorEditorView(
  editorParentRef: RefObject<HTMLDivElement | null>,
  props: ItemBodyMarkdownEditorProps,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  const editorViewRef = useRef<EditorView | null>(null);
  useEffect(() => {
    autosaveTrackerRef.current = {
      hasUnsavedChanges: false,
      isSaving: false,
      lastInsertExitAt: null,
      lastInsertMode: null,
      changeId: 0
    };
    return mountEditorView(
      editorParentRef.current,
      editorViewRef,
      props,
      autosaveTrackerRef,
      onAutosaveRef,
      onSaveRef,
      onExitNormalModeRef,
      onVimModeChangeRef,
      setSaveState
    );
  }, [props.itemId, props.readOnly]);

  useEffect(() => {
    const handler = () => {
      if (editorViewRef.current) {
        applyBulletPoints(editorViewRef.current);
      }
    };
    window.addEventListener(FORMAT_BULLET_EVENT, handler);
    return () => window.removeEventListener(FORMAT_BULLET_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (editorViewRef.current) {
        applyNumberedList(editorViewRef.current);
      }
    };
    window.addEventListener(FORMAT_NUMBERED_LIST_EVENT, handler);
    return () => window.removeEventListener(FORMAT_NUMBERED_LIST_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (editorViewRef.current) {
        applyNormalText(editorViewRef.current);
      }
    };
    window.addEventListener(FORMAT_NORMAL_TEXT_EVENT, handler);
    return () => window.removeEventListener(FORMAT_NORMAL_TEXT_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (editorViewRef.current) {
        applyLetteredList(editorViewRef.current);
      }
    };
    window.addEventListener(FORMAT_LETTERED_LIST_EVENT, handler);
    return () => window.removeEventListener(FORMAT_LETTERED_LIST_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (editorViewRef.current) {
        applyChecklist(editorViewRef.current);
      }
    };
    window.addEventListener(FORMAT_CHECKLIST_EVENT, handler);
    return () => window.removeEventListener(FORMAT_CHECKLIST_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (editorViewRef.current) {
        applyChecklist(editorViewRef.current, true);
      }
    };
    window.addEventListener(FORMAT_CHECKLIST_CHECKED_EVENT, handler);
    return () => window.removeEventListener(FORMAT_CHECKLIST_CHECKED_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (editorViewRef.current) {
        applyChecklist(editorViewRef.current, false);
      }
    };
    window.addEventListener(FORMAT_CHECKLIST_UNCHECKED_EVENT, handler);
    return () => window.removeEventListener(FORMAT_CHECKLIST_UNCHECKED_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      if (!editorViewRef.current) return;
      const level = (e as CustomEvent<{ level: 1 | 2 | 3 }>).detail?.level;
      if (level >= 1 && level <= 3) {
        applyHeading(editorViewRef.current, level as 1 | 2 | 3);
      }
    };
    window.addEventListener(FORMAT_HEADING_EVENT, handler);
    return () => window.removeEventListener(FORMAT_HEADING_EVENT, handler);
  }, []);
}

function mountEditorView(
  parent: HTMLDivElement | null,
  editorViewRef: MutableRefObject<EditorView | null>,
  props: ItemBodyMarkdownEditorProps,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  if (!parent) {
    return undefined;
  }

  const view = createEditorView(parent, props, autosaveTrackerRef, onAutosaveRef, onSaveRef, onExitNormalModeRef, onVimModeChangeRef, setSaveState);
  editorViewRef.current = view;
  focusEditableEditorView(view, props.readOnly === true, autosaveTrackerRef);
  return () => destroyEditorView(view, editorViewRef);
}

function focusEditableEditorView(
  view: EditorView,
  readOnly: boolean,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>
) {
  if (!readOnly) {
    view.focus();
  }

  const tracker = autosaveTrackerRef.current;
  const insertMode = getCM(view)?.state?.vim?.insertMode ?? null;
  tracker.lastInsertMode = insertMode;
}

function destroyEditorView(view: EditorView, editorViewRef: MutableRefObject<EditorView | null>) {
  view.destroy();
  editorViewRef.current = null;
}

function createEditorView(
  parent: HTMLDivElement,
  props: ItemBodyMarkdownEditorProps,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
): EditorView {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: normalizedInitialBody(props.initialBody),
      extensions: editorExtensions(props.readOnly === true, autosaveTrackerRef, onAutosaveRef, onSaveRef, onExitNormalModeRef, onVimModeChangeRef, setSaveState)
    })
  });
  const initialMode = resolveVimMode(view);
  view.contentDOM.dataset.vimMode = initialMode === "INSERT" ? "insert" : "normal";
  onVimModeChangeRef.current?.(initialMode);
  return view;
}

function editorExtensions(
  readOnly: boolean,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return [
    vim(),
    ...editorBehaviorExtensions(readOnly, autosaveTrackerRef, onAutosaveRef, onSaveRef, onExitNormalModeRef, onVimModeChangeRef, setSaveState),
    ...editorKeymapExtensions(onAutosaveRef, onSaveRef, setSaveState)
  ];
}

function editorBehaviorExtensions(
  readOnly: boolean,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return [
    lineNumbers(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    markdown(),
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.lineWrapping,
    markdownBulletsPlugin,
    markdownHeadingsPlugin,
    markdownChecklistPlugin,
    EditorView.updateListener.of((update) =>
      autosaveAfterFinishedEdit(update.view, update.docChanged, readOnly, autosaveTrackerRef, onAutosaveRef, onVimModeChangeRef, setSaveState)
    ),
    normalModeEscapeHandler(readOnly, autosaveTrackerRef, onSaveRef, onExitNormalModeRef, setSaveState)
  ];
}

function autosaveAfterFinishedEdit(
  view: EditorView,
  docChanged: boolean,
  readOnly: boolean,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  const mode = resolveVimMode(view);
  view.contentDOM.dataset.vimMode = mode === "INSERT" ? "insert" : "normal";
  onVimModeChangeRef.current?.(mode);

  const tracker = autosaveTrackerRef.current;
  const insertMode = getCM(view)?.state?.vim?.insertMode ?? null;
  const exitedInsert = tracker.lastInsertMode === true && insertMode === false;
  if (exitedInsert) {
    tracker.lastInsertExitAt = Date.now();
  }
  updateAutosaveTracker(tracker, docChanged, insertMode, setSaveState);
  if (readOnly || tracker.isSaving || !shouldAutosave(tracker, docChanged, exitedInsert, insertMode)) {
    return;
  }
  void saveChangedMarkdownBody(view, tracker, onAutosaveRef.current, setSaveState);
}

function updateAutosaveTracker(
  tracker: AutosaveTracker,
  docChanged: boolean,
  insertMode: boolean | null,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  if (docChanged) {
    tracker.hasUnsavedChanges = true;
    tracker.changeId += 1;
    setSaveState("unsaved");
  }
  if (insertMode !== null) {
    tracker.lastInsertMode = insertMode;
  }
}

function shouldAutosave(
  tracker: AutosaveTracker,
  docChanged: boolean,
  exitedInsert: boolean,
  insertMode: boolean | null
): boolean {
  return tracker.hasUnsavedChanges && (exitedInsert || (docChanged && insertMode === false));
}

async function saveChangedMarkdownBody(
  view: EditorView,
  tracker: AutosaveTracker,
  onAutosave: ItemBodyMarkdownEditorProps["onAutosave"],
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  const saveVersion = tracker.changeId;
  tracker.isSaving = true;
  setSaveState("saving");
  try {
    await saveNormalizedMarkdownBody(view.state.doc.toString(), async (body) => onAutosave?.(body));
    await runPostSaveEffects();
    markAutosaveComplete(tracker, saveVersion, setSaveState);
  } catch (error: unknown) {
    console.error("Failed to autosave markdown body", error);
    setSaveState("error");
  } finally {
    tracker.isSaving = false;
  }
}

function markAutosaveComplete(
  tracker: AutosaveTracker,
  saveVersion: number,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  if (tracker.changeId !== saveVersion) {
    return;
  }
  tracker.hasUnsavedChanges = false;
  setSaveState("saved");
}

function normalModeEscapeHandler(
  readOnly: boolean,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return EditorView.domEventHandlers({
    keydown: (event, view) => {
      const isEscape = event.key === "Escape";
      const isCtrlH = event.key === "h" && event.ctrlKey;

      if (readOnly || (!isEscape && !isCtrlH) || !isVimNormalMode(view)) {
        return false;
      }

      if (autosaveTrackerRef.current.lastInsertMode === true) {
        return false;
      }

      if (isRecentInsertExit(autosaveTrackerRef.current)) {
        return false;
      }

      event.preventDefault();
      void saveAndExitOnNormalMode(view, onSaveRef.current, onExitNormalModeRef.current, setSaveState).catch((error: unknown) => {
        console.error("Failed to save markdown body when leaving Vim normal mode", error);
        setSaveState("error");
      });
      return true;
    }
  });
}

/** Returns the Decoration for a bullet at a given indent level (cycles 0→1→2→0…). */
function bulletDecorationForLevel(indentSpaces: number): Decoration {
  const level = Math.floor(indentSpaces / 2) % 3;
  return Decoration.mark({ class: `cm-bullet-mark cm-bullet-level-${level}` });
}

function bulletMarkerTo(view: EditorView, from: number, to: number): number {
  const marker = view.state.sliceDoc(from, to);
  if (/\s$/.test(marker)) {
    return to;
  }
  return view.state.sliceDoc(to, to + 1) === " " ? to + 1 : to;
}

const markdownBulletsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView) {
      const activeLines = selectedLineNumbers(view);
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node: any) => {
            if (node.name === "ListMark") {
              const text = view.state.sliceDoc(node.from, node.to);
              if (/^[-*+]\s*$/.test(text)) {
                const line = view.state.doc.lineAt(node.from);
                if (activeLines.has(line.number)) {
                  return;
                }
                const indent = line.text.match(/^(\s*)/)?.[1].length ?? 0;
                builder.add(node.from, bulletMarkerTo(view, node.from, node.to), bulletDecorationForLevel(indent));
              }
            }
          }
        });
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations
  }
);

class ChecklistBoxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super();
  }

  eq(other: ChecklistBoxWidget): boolean {
    return this.checked === other.checked;
  }

  toDOM(): HTMLElement {
    const box = document.createElement("span");
    box.className = this.checked ? "cm-checklist-box cm-checklist-box--checked" : "cm-checklist-box";
    return box;
  }
}

const checklistTextDecoration = Decoration.mark({ class: "cm-checklist-text" });
const checklistCheckedTextDecoration = Decoration.mark({ class: "cm-checklist-text cm-checklist-text--checked" });

const headingMark = Decoration.mark({ class: "cm-heading-mark" });
const hiddenHeadingPrefix = Decoration.replace({});

const headingLineDecorations: Record<number, Decoration> = {
  1: Decoration.line({ class: "cm-md-heading-1" }),
  2: Decoration.line({ class: "cm-md-heading-2" }),
  3: Decoration.line({ class: "cm-md-heading-3" }),
};

const markdownHeadingsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView) {
      // Collect line and mark decorations separately, then merge sorted by from.
      const activeLines = selectedLineNumbers(view);
      const lineDecos: [number, number, Decoration][] = [];
      const markDecos: [number, number, Decoration][] = [];

      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node: any) => {
            const headingMatch = node.name.match(/^ATXHeading(\d)$/);
            if (headingMatch) {
              const level = parseInt(headingMatch[1], 10);
              const deco = headingLineDecorations[level];
              if (deco) {
                const line = view.state.doc.lineAt(node.from);
                lineDecos.push([line.from, line.from, deco]);
              }
            }
            if (node.name === "HeaderMark") {
              markDecos.push(headingPrefixDecoration(view, activeLines, node.from, node.to));
            }
          }
        });
      }

      // Line decos must come before mark decos at the same `from` position.
      const all = [
        ...lineDecos,
        ...markDecos,
      ].sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);

      const builder = new RangeSetBuilder<Decoration>();
      for (const [from, to, deco] of all) {
        builder.add(from, to, deco);
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

const markdownChecklistPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView) {
      const activeLines = selectedLineNumbers(view);
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
          const line = view.state.doc.lineAt(pos);
          const match = line.text.match(/^(\s*)([-*+]\s+\[[ xX]\]\s+)(.*)$/);
          if (match) {
            if (activeLines.has(line.number)) {
              pos = line.to + 1;
              continue;
            }
            const indent = match[1].length;
            const marker = match[2];
            const isChecked = /\[[xX]\]/.test(marker);
            const markerFrom = line.from + indent;
            const markerTo = markerFrom + marker.length;
            builder.add(markerFrom, markerTo, Decoration.replace({ widget: new ChecklistBoxWidget(isChecked) }));
            const contentFrom = markerTo;
            if (contentFrom < line.to) {
              const textDeco = isChecked ? checklistCheckedTextDecoration : checklistTextDecoration;
              builder.add(contentFrom, line.to, textDeco);
            }
          }
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

function selectedLineNumbers(view: EditorView): Set<number> {
  const activeLines = new Set<number>();
  for (const range of view.state.selection.ranges) {
    activeLines.add(view.state.doc.lineAt(range.head).number);
  }
  return activeLines;
}

function headingPrefixDecoration(
  view: EditorView,
  activeLines: Set<number>,
  from: number,
  to: number
): [number, number, Decoration] {
  const line = view.state.doc.lineAt(from);
  if (activeLines.has(line.number)) {
    return [from, to, headingMark];
  }
  const prefixTo = view.state.sliceDoc(to, to + 1) === " " ? to + 1 : to;
  return [from, prefixTo, hiddenHeadingPrefix];
}

/** Regex matching any markdown block prefix: bullets, numbered lists, or headings. */
const MARKDOWN_PREFIX_RE = /^(\s*)(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+|[a-zA-Z]\.\s+)?/;

/**
 * Strips any existing markdown block prefix (heading or bullet) from a line.
 * Returns the indent and content without the prefix.
 */
function stripMarkdownPrefix(text: string): { indent: string; prefixLen: number; content: string } {
  const match = text.match(MARKDOWN_PREFIX_RE);
  const indent = match?.[1] ?? "";
  const prefix = match?.[2] ?? "";
  return { indent, prefixLen: indent.length + prefix.length, content: text.slice(indent.length + prefix.length) };
}

function iterateSelectedLines(
  state: ReturnType<typeof EditorView.prototype.state.toJSON>["doc"] extends never ? never : EditorView["state"],
  cb: (line: ReturnType<typeof EditorView.prototype.state.doc.line>, startLine: number, endLine: number) => void
) {
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    let endLine = state.doc.lineAt(range.to).number;
    if (range.to > range.from && range.to === state.doc.line(endLine).from) endLine--;
    for (let i = startLine; i <= endLine; i++) {
      cb(state.doc.line(i), startLine, endLine);
    }
  }
}

function exitVisualModeAfterFormatting(view: EditorView) {
  const cm = getCM(view);
  if (cm?.state?.vim?.visualMode) {
    Vim.exitVisualMode(cm as CodeMirrorV);
  }
}

function applyBulletPoints(view: EditorView) {
  const { state, dispatch } = view;
  const changes: { from: number; to?: number; insert: string }[] = [];

  iterateSelectedLines(state, (line, startLine, endLine) => {
    const { indent, prefixLen, content } = stripMarkdownPrefix(line.text);
    const existingPrefix = line.text.slice(indent.length, prefixLen);
    const isBullet = /^[-*+]\s+/.test(existingPrefix);

    if (!isBullet && (content.trim().length > 0 || startLine === endLine)) {
      // replace any heading prefix with bullet
      changes.push({ from: line.from + indent.length, to: line.from + prefixLen, insert: "- " });
    }
  });

  if (changes.length > 0) dispatch({ changes });
  exitVisualModeAfterFormatting(view);
}

function applyNumberedList(view: EditorView) {
  const { state, dispatch } = view;
  const changes: { from: number; to?: number; insert: string }[] = [];
  let number = 1;

  iterateSelectedLines(state, (line, startLine, endLine) => {
    const { indent, prefixLen, content } = stripMarkdownPrefix(line.text);
    const existingPrefix = line.text.slice(indent.length, prefixLen);
    const numberedPrefix = `${number}. `;

    if (content.trim().length > 0 || startLine === endLine) {
      if (existingPrefix !== numberedPrefix) {
        changes.push({ from: line.from + indent.length, to: line.from + prefixLen, insert: numberedPrefix });
      }
      number += 1;
    }
  });

  if (changes.length > 0) dispatch({ changes });
  exitVisualModeAfterFormatting(view);
}

function applyHeading(view: EditorView, level: 1 | 2 | 3) {
  const { state, dispatch } = view;
  const hashes = "#".repeat(level) + " ";
  const changes: { from: number; to?: number; insert: string }[] = [];

  iterateSelectedLines(state, (line, startLine, endLine) => {
    const { indent, prefixLen, content } = stripMarkdownPrefix(line.text);
    const existingPrefix = line.text.slice(indent.length, prefixLen);
    const sameHeading = existingPrefix === hashes;

    if (!sameHeading && (content.trim().length > 0 || startLine === endLine)) {
      // replace existing prefix (bullet or different heading) with new heading
      changes.push({ from: line.from + indent.length, to: line.from + prefixLen, insert: hashes });
    }
  });

  if (changes.length > 0) dispatch({ changes });
  exitVisualModeAfterFormatting(view);
}

function applyNormalText(view: EditorView) {
  const { state, dispatch } = view;
  const changes: { from: number; to?: number; insert: string }[] = [];

  iterateSelectedLines(state, (line, startLine, endLine) => {
    const { indent, prefixLen, content } = stripMarkdownPrefix(line.text);
    const hasPrefix = prefixLen > indent.length;
    if (hasPrefix && (content.trim().length > 0 || startLine === endLine)) {
      changes.push({ from: line.from + indent.length, to: line.from + prefixLen, insert: "" });
    }
  });

  if (changes.length > 0) dispatch({ changes });
  exitVisualModeAfterFormatting(view);
}

function applyLetteredList(view: EditorView) {
  const { state, dispatch } = view;
  const changes: { from: number; to?: number; insert: string }[] = [];
  let index = 0;

  iterateSelectedLines(state, (line, startLine, endLine) => {
    const { indent, prefixLen, content } = stripMarkdownPrefix(line.text);
    if (content.trim().length === 0 && startLine !== endLine) {
      return;
    }
    const letter = String.fromCharCode(97 + (index % 26));
    const letterPrefix = `${letter}. `;
    const existingPrefix = line.text.slice(indent.length, prefixLen);
    if (existingPrefix !== letterPrefix) {
      changes.push({ from: line.from + indent.length, to: line.from + prefixLen, insert: letterPrefix });
    }
    index += 1;
  });

  if (changes.length > 0) dispatch({ changes });
  exitVisualModeAfterFormatting(view);
}

function applyChecklist(view: EditorView, checked?: boolean) {
  const { state, dispatch } = view;
  const changes: { from: number; to?: number; insert: string }[] = [];

  iterateSelectedLines(state, (line, startLine, endLine) => {
    const { indent, prefixLen, content } = stripMarkdownPrefix(line.text);
    if (content.trim().length === 0 && startLine !== endLine) {
      return;
    }
    const existingPrefix = line.text.slice(indent.length, prefixLen);
    if (/^[-*+]\s+\[[ xX]\]\s+/.test(existingPrefix) && checked === undefined) {
      return;
    }
    if (checked === true) {
      changes.push({ from: line.from + indent.length, to: line.from + prefixLen, insert: "- [x] " });
      return;
    }
    if (checked === false) {
      changes.push({ from: line.from + indent.length, to: line.from + prefixLen, insert: "- [ ] " });
      return;
    }
    changes.push({ from: line.from + indent.length, to: line.from + prefixLen, insert: "- [ ] " });
  });

  if (changes.length > 0) dispatch({ changes });
  exitVisualModeAfterFormatting(view);
}

function isRecentInsertExit(tracker: AutosaveTracker): boolean {
  if (tracker.lastInsertExitAt === null) {
    return false;
  }
  return Date.now() - tracker.lastInsertExitAt < 150;
}

function resolveVimMode(view: EditorView): "NORMAL" | "INSERT" | "VISUAL" {
  const cm = getCM(view);
  const vimState = cm?.state?.vim;
  if (!vimState) return "NORMAL";
  if (vimState.visualMode) return "VISUAL";
  if (vimState.insertMode) return "INSERT";
  return "NORMAL";
}

function isVimNormalMode(view: EditorView): boolean {
  return resolveVimMode(view) === "NORMAL";
}

async function saveAndExitOnNormalMode(
  view: EditorView,
  onSave: ItemBodyMarkdownEditorProps["onSave"],
  onExitNormalMode: ItemBodyMarkdownEditorProps["onExitNormalMode"],
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  setSaveState("saving");
  const savedBody = await saveNormalizedMarkdownBody(view.state.doc.toString(), async (body) => onSave?.(body));
  setSaveState("saved");
  await onExitNormalMode?.(savedBody);
}

function editorKeymapExtensions(
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return [
    keymap.of([{ key: "Mod-s", run: saveMarkdownBodyCommand(onAutosaveRef, onSaveRef, setSaveState) }]),
    keymap.of([...historyKeymap, ...defaultKeymap])
  ];
}

function saveMarkdownBodyCommand(
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return createSaveItemBodyCommand(
    async (body) => saveMarkdownBody(onAutosaveRef.current ?? onSaveRef.current, body, setSaveState),
    runPostSaveEffects,
    () => setSaveState("error")
  );
}

async function saveMarkdownBody(
  onSave: ItemBodyMarkdownEditorProps["onSave"],
  body: string,
  setSaveState: (state: MarkdownBodySaveState) => void
): Promise<void> {
  setSaveState("saving");
  await onSave?.(body);
  setSaveState("saved");
}
