import { history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, Prec } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers
} from "@codemirror/view";
import { getCM, Vim, vim, type CodeMirrorV } from "@replit/codemirror-vim";
import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { INSERT_BLOCK_ENTITY_EVENT, type InsertBlockEntityEventDetail } from "./assetEditorEvents.ts";
import {
  FORMAT_BOLD_EVENT,
  FORMAT_BULLET_EVENT,
  FORMAT_CHECKLIST_CHECKED_EVENT,
  FORMAT_CHECKLIST_EVENT,
  FORMAT_CHECKLIST_UNCHECKED_EVENT,
  FORMAT_CLEAR_INLINE_EVENT,
  FORMAT_CODE_EVENT,
  FORMAT_DIVIDER_EVENT,
  FORMAT_HEADING_EVENT,
  FORMAT_ITALIC_EVENT,
  FORMAT_LETTERED_LIST_EVENT,
  FORMAT_NORMAL_TEXT_EVENT,
  FORMAT_NUMBERED_LIST_EVENT,
  FORMAT_QUOTE_EVENT,
  FORMAT_TOGGLE_FOLD_EVENT,
  OPEN_CURSOR_TARGET_EVENT
} from "./bodyEditorEvents.ts";
import {
  clearFormatting,
  formatMarkerBackspaceTransaction,
  insertDivider,
  setBlockType,
  toggleWrap,
  wrapLink
} from "./cmFormat.ts";
import { headingFoldingExtension, registerHeadingFoldVimCommands, toggleHeadingAtCursor } from "./cmHeadingFold.ts";
import { itemDocumentIdFacet, livePreviewPlugin, refreshLivePreviewEffect } from "./cmLivePreview.ts";
import { registerDisplayLineMotions } from "./cmDisplayLineMotion.ts";
import { registerHeadingMotions } from "./cmHeadingMotion.ts";
import { registerCheckboxVimCommands, toggleCheckbox } from "./cmToggleCheckbox.ts";
import { vimClipboardPasteExtension } from "./cmClipboardPaste.ts";
import { applyVimInsertEscape, buildVimAwareDefaultKeymap } from "./cmVimKeymaps.ts";
import { buildZenEditorKeymap } from "./cmEditorKeymaps.ts";
import { wireYankHighlight, yankHighlightExtension } from "./cmYankHighlight.ts";
import {
  bodyForPersistence,
  itemBodyStateField,
  normalizeBodyForClient
} from "./itemBodyUtils.ts";
import { handleListContinuationEnter, registerListContinuationMotions } from "./listContinuation.ts";
import { INSERT_MARKDOWN_LINK_EVENT, type InsertMarkdownLinkEventDetail } from "./markdownLinks.tsx";
import { findOpenableEditorTarget } from "./openEditorTarget.ts";
import { openAssetWithDefaultApp, openExternalUrl } from "./openExternalResource.ts";
import { getActiveEditorView, registerActiveEditorView } from "../keybinds/activeEditorRegistry.ts";
import type { ItemBody } from "./types.ts";

export type MarkdownBodySaveState = "saved" | "unsaved" | "saving" | "error";

export type ItemBodyMarkdownEditorProps = Readonly<{
  itemId: string;
  initialBody?: ItemBody | null;
  readOnly?: boolean;
  onAutosave?: (body: ItemBody) => Promise<void>;
  onSave?: (body: ItemBody) => Promise<void>;
  onExitNormalMode?: (body: ItemBody) => Promise<void>;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
}>;

type AutosaveTracker = {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastInsertExitAt: number | null;
  lastInsertMode: boolean | null;
  changeId: number;
};

const cursorCache = new Map<string, object>();

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

  return (
    <div className="inbox-detail__markdown-editor">
      <div ref={editorParentRef} className="inbox-detail__codemirror" />
    </div>
  );
}

function useLatestCallbackRef<T>(callback: T) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  return callbackRef;
}

function exitVisualModeAfterFormatting(view: EditorView) {
  const cm = getCM(view);
  if (cm?.state?.vim?.visualMode) {
    Vim.exitVisualMode(cm as CodeMirrorV);
  }
}

async function openCursorTarget(view: EditorView): Promise<void> {
  const body = view.state.field(itemBodyStateField);
  const target = findOpenableEditorTarget(body, view.state.selection.main.head);
  if (!target) return;
  if (target.type === "link") return openExternalUrl(target.url);
  return openAssetWithDefaultApp(target.entity);
}

function restoreCachedSelection(itemId: string, maxLen: number): EditorSelection | undefined {
  if (!cursorCache.has(itemId)) return undefined;
  try {
    const sel = EditorSelection.fromJSON(cursorCache.get(itemId));
    const valid = sel.ranges.every((r) => r.from <= maxLen && r.to <= maxLen);
    return valid ? sel : undefined;
  } catch {
    return undefined;
  }
}

function initVimExtensions(): void {
  wireYankHighlight();
  registerHeadingMotions();
  registerDisplayLineMotions();
  applyVimInsertEscape("jk");
  registerListContinuationMotions();
  registerCheckboxVimCommands();
  registerHeadingFoldVimCommands();
}

function createEditorExtensions(
  props: ItemBodyMarkdownEditorProps,
  body: ItemBody,
  viewRef: MutableRefObject<EditorView | null>,
  autosaveTrackerRef: MutableRefObject<AutosaveTracker>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return [
    itemBodyStateField.init(() => body),
    itemDocumentIdFacet.of(props.itemId),
    markdown({ base: markdownLanguage, addKeymap: false }),
    livePreviewPlugin,
    vim(),
    headingFoldingExtension(),
    lineNumbers(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    yankHighlightExtension,
    vimClipboardPasteExtension,
    EditorState.readOnly.of(props.readOnly === true),
    EditorView.editable.of(!props.readOnly),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        cursorCache.set(props.itemId, update.state.selection.toJSON());
      }
      autosaveAfterFinishedEdit(
        update.view,
        update.docChanged,
        props.readOnly === true,
        autosaveTrackerRef,
        onAutosaveRef,
        onVimModeChangeRef,
        setSaveState
      );
    }),
    EditorView.domEventHandlers({
      focus: () => {
        if (viewRef.current) registerActiveEditorView(viewRef.current);
        return false;
      },
      blur: () => {
        if (viewRef.current && getActiveEditorView() === viewRef.current) registerActiveEditorView(null);
        return false;
      },
      keydown: (e, v) => handleEditorKeydown(e, v, props.readOnly, onSaveRef, onExitNormalModeRef, setSaveState)
    }),
    Prec.highest(
      keymap.of([
        { key: "Enter", run: handleListContinuationEnter },
        { key: "Mod-Enter", run: toggleCheckbox },
        {
          key: "Backspace",
          run: (v) => {
            const tr = formatMarkerBackspaceTransaction(v.state);
            if (!tr) return false;
            v.dispatch(tr);
            return true;
          }
        }
      ])
    ),
    Prec.high(keymap.of([
      ...buildZenEditorKeymap(props.readOnly === true),
      { key: "Mod-s", run: () => saveFromKeybind(props, viewRef, onAutosaveRef, onSaveRef, setSaveState) }
    ])),
    keymap.of([...historyKeymap, ...buildVimAwareDefaultKeymap()])
  ];
}

function saveFromKeybind(
  props: ItemBodyMarkdownEditorProps,
  viewRef: RefObject<EditorView | null>,
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
): boolean {
  if (props.readOnly || !viewRef.current) return false;
  const callback = onAutosaveRef.current ?? onSaveRef.current;
  saveMarkdownBody(callback, viewRef.current.state.field(itemBodyStateField), setSaveState);
  return true;
}

function handleEditorKeydown(
  e: KeyboardEvent,
  v: EditorView,
  readOnly: boolean | undefined,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
): boolean {
  const isEscape = e.key === "Escape";
  const isCtrlH = e.key === "h" && e.ctrlKey;
  if (readOnly || (!isEscape && !isCtrlH) || getCM(v)?.state?.vim?.insertMode !== false) {
    return false;
  }
  e.preventDefault();
  void saveAndExitOnNormalMode(v, onSaveRef.current, onExitNormalModeRef.current, setSaveState);
  return true;
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
    if (!editorParentRef.current) return;
    const body = normalizeBodyForClient(props.initialBody);
    const selection = restoreCachedSelection(props.itemId, body.text.length);
    initVimExtensions();

    const extensions = createEditorExtensions(
      props,
      body,
      editorViewRef,
      autosaveTrackerRef,
      onAutosaveRef,
      onSaveRef,
      onExitNormalModeRef,
      onVimModeChangeRef,
      setSaveState
    );

    const view = new EditorView({
      parent: editorParentRef.current,
      state: EditorState.create({ doc: body.text, selection, extensions })
    });

    editorViewRef.current = view;
    if (!props.readOnly) {
      view.focus();
      registerActiveEditorView(view);
    }
    setupVimModeTracker(view, onVimModeChangeRef);

    return () => {
      if (getActiveEditorView() === view) registerActiveEditorView(null);
      view.destroy();
      editorViewRef.current = null;
    };
  }, [props.itemId, props.readOnly]);

  useEffect(() => {
    return registerEditorEventHandlers(editorViewRef);
  }, []);
}

function setupVimModeTracker(
  view: EditorView,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>
): void {
  const cm = getCM(view);
  const initialMode = cm?.state?.vim?.insertMode ? "INSERT" : "NORMAL";
  view.contentDOM.dataset.vimMode = initialMode.toLowerCase();
  onVimModeChangeRef.current?.(initialMode);

  const onModeChange = (e: { mode?: string }) => {
    const normalized = (e.mode?.toUpperCase() ?? "NORMAL") as "NORMAL" | "INSERT" | "VISUAL";
    view.contentDOM.dataset.vimMode = normalized.toLowerCase();
    onVimModeChangeRef.current?.(normalized);
    queueMicrotask(() => {
      try {
        view.dispatch({ effects: refreshLivePreviewEffect.of() });
      } catch {
        // Ignored if view is unmounted or in tearing down
      }
    });
  };
  cm?.on("vim-mode-change", onModeChange);
}

function runFormatCommand(viewRef: RefObject<EditorView | null>, action: (v: EditorView) => boolean): void {
  if (!viewRef.current) return;
  action(viewRef.current);
  exitVisualModeAfterFormatting(viewRef.current);
}

function handleInsertLinkEvent(viewRef: RefObject<EditorView | null>, detail: InsertMarkdownLinkEventDetail): void {
  const view = viewRef.current;
  if (!view) return;
  const text = detail.text?.trim() || detail.url.trim();
  if (!text || !detail.url.trim()) return;
  const range = view.state.selection.main;
  const insert = `[${text}](${detail.url})`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(range.from + insert.length)
  });
  exitVisualModeAfterFormatting(view);
}

function handleInsertAssetEvent(viewRef: RefObject<EditorView | null>, detail: InsertBlockEntityEventDetail): void {
  const view = viewRef.current;
  if (!view) return;
  const range = view.state.selection.main;
  const displayName = escapeMarkdownLabel(detail.displayName || detail.assetId);
  const relativePath = itemLocalAssetPath(detail);
  const prefix = detail.image ? "!" : "";
  const markdown = `${prefix}[${displayName}](${relativePath})`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: markdown },
    selection: EditorSelection.cursor(range.from + markdown.length)
  });
  setTimeout(() => view.focus(), 0);
}

function itemLocalAssetPath(detail: InsertBlockEntityEventDetail): string {
  const fileName = detail.relativePath?.split("/").pop() || detail.displayName || "asset";
  return `assets/${detail.assetId}/${encodeURIComponent(fileName)}`;
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function registerEditorEventHandlers(viewRef: RefObject<EditorView | null>): () => void {
  const handlers: Record<string, EventListener> = {
    [FORMAT_BULLET_EVENT]: () => runFormatCommand(viewRef, (v) => setBlockType(v, "bullet")),
    [FORMAT_NUMBERED_LIST_EVENT]: () => runFormatCommand(viewRef, (v) => setBlockType(v, "numbered")),
    [FORMAT_LETTERED_LIST_EVENT]: () => runFormatCommand(viewRef, (v) => setBlockType(v, "numbered")),
    [FORMAT_CHECKLIST_EVENT]: () => runFormatCommand(viewRef, (v) => setBlockType(v, "todo")),
    [FORMAT_CHECKLIST_CHECKED_EVENT]: () => runFormatCommand(viewRef, (v) => setBlockType(v, "todo-checked")),
    [FORMAT_CHECKLIST_UNCHECKED_EVENT]: () => runFormatCommand(viewRef, (v) => setBlockType(v, "todo")),
    [FORMAT_DIVIDER_EVENT]: () => runFormatCommand(viewRef, insertDivider),
    [FORMAT_QUOTE_EVENT]: () => runFormatCommand(viewRef, (v) => setBlockType(v, "quote")),
    [FORMAT_NORMAL_TEXT_EVENT]: () => runFormatCommand(viewRef, (v) => setBlockType(v, "paragraph")),
    [FORMAT_BOLD_EVENT]: () => runFormatCommand(viewRef, (v) => toggleWrap(v, "**")),
    [FORMAT_ITALIC_EVENT]: () => runFormatCommand(viewRef, (v) => toggleWrap(v, "*")),
    [FORMAT_CODE_EVENT]: () => runFormatCommand(viewRef, (v) => toggleWrap(v, "`")),
    [FORMAT_CLEAR_INLINE_EVENT]: () => runFormatCommand(viewRef, clearFormatting),
    [FORMAT_HEADING_EVENT]: ((e: CustomEvent<{ level: 1 | 2 | 3 }>) => {
      runFormatCommand(viewRef, (v) => setBlockType(v, `h${e.detail?.level || 1}` as any));
    }) as EventListener,
    [OPEN_CURSOR_TARGET_EVENT]: () => {
      if (viewRef.current) void openCursorTarget(viewRef.current);
    },
    [FORMAT_TOGGLE_FOLD_EVENT]: () => {
      if (viewRef.current) toggleHeadingAtCursor(viewRef.current);
    },
    [INSERT_MARKDOWN_LINK_EVENT]: ((e: CustomEvent<InsertMarkdownLinkEventDetail>) => {
      handleInsertLinkEvent(viewRef, e.detail);
    }) as EventListener,
    [INSERT_BLOCK_ENTITY_EVENT]: ((e: CustomEvent<InsertBlockEntityEventDetail>) => {
      handleInsertAssetEvent(viewRef, e.detail);
    }) as EventListener
  };

  for (const [evt, handler] of Object.entries(handlers)) window.addEventListener(evt, handler);
  return () => {
    for (const [evt, handler] of Object.entries(handlers)) window.removeEventListener(evt, handler);
  };
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
  const insertMode = getCM(view)?.state?.vim?.insertMode ?? null;
  const mode = insertMode ? "INSERT" : (getCM(view)?.state?.vim?.visualMode ? "VISUAL" : "NORMAL");
  view.contentDOM.dataset.vimMode = mode.toLowerCase();
  onVimModeChangeRef.current?.(mode);

  const tracker = autosaveTrackerRef.current;
  const exitedInsert = tracker.lastInsertMode === true && insertMode === false;
  if (exitedInsert) tracker.lastInsertExitAt = Date.now();
  if (docChanged) {
    tracker.hasUnsavedChanges = true;
    tracker.changeId += 1;
    setSaveState("unsaved");
  }
  if (insertMode !== null) tracker.lastInsertMode = insertMode;

  if (readOnly || tracker.isSaving || (!tracker.hasUnsavedChanges || !(exitedInsert || (docChanged && insertMode === false)))) {
    return;
  }
  const saveVersion = tracker.changeId;
  tracker.isSaving = true;
  setSaveState("saving");
  onAutosaveRef.current?.(bodyForPersistence(view.state.field(itemBodyStateField))).then(() => {
    if (tracker.changeId === saveVersion) {
      tracker.hasUnsavedChanges = false;
      setSaveState("saved");
    }
  }).catch(() => setSaveState("error")).finally(() => {
    tracker.isSaving = false;
  });
}

async function saveAndExitOnNormalMode(
  view: EditorView,
  onSave: ItemBodyMarkdownEditorProps["onSave"] | undefined,
  onExitNormalMode: ItemBodyMarkdownEditorProps["onExitNormalMode"] | undefined,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  setSaveState("saving");
  const body = bodyForPersistence(view.state.field(itemBodyStateField));
  if (onSave) await onSave(body);
  setSaveState("saved");
  if (onExitNormalMode) await onExitNormalMode(body);
}

async function saveMarkdownBody(
  onSave: ItemBodyMarkdownEditorProps["onSave"] | undefined,
  body: ItemBody,
  setSaveState: (state: MarkdownBodySaveState) => void
): Promise<void> {
  setSaveState("saving");
  if (onSave) await onSave(bodyForPersistence(body));
  setSaveState("saved");
}
