import { history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, Prec, type Extension } from "@codemirror/state";
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
  itemBodyStateEffect,
  itemBodyStateField,
  normalizeBodyForClient
} from "./itemBodyUtils.ts";
import {
  editorModeExtensions,
  reconfigureEditorCompartments,
  syncReadOnlyBody
} from "./itemBodyEditorMode.ts";
import {
  createItemBodyPersistenceQueue,
  type ItemBodyPersistenceQueue,
  type ItemBodyPersistenceState
} from "./itemBodyPersistence.ts";
import { handleListContinuationEnter, registerListContinuationMotions } from "./listContinuation.ts";
import { INSERT_MARKDOWN_LINK_EVENT, type InsertMarkdownLinkEventDetail } from "./markdownLinks.tsx";
import { findOpenableEditorTarget } from "./openEditorTarget.ts";
import { openAssetWithDefaultApp, openExternalUrl } from "./openExternalResource.ts";
import { getActiveEditorView, registerActiveEditorView } from "../keybinds/activeEditorRegistry.ts";
import type { ItemBody } from "./types.ts";

export type MarkdownBodySaveState = ItemBodyPersistenceState;

export type ItemBodyMarkdownEditorProps = Readonly<{
  itemId: string;
  initialBody?: ItemBody | null;
  readOnly?: boolean;
  onAutosave?: (body: ItemBody) => Promise<void>;
  onSave?: (body: ItemBody) => Promise<void>;
  onExitNormalMode?: (body: ItemBody) => Promise<void>;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
}>;

type EditorCallbackRefs = Readonly<{
  autosave: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>;
  save: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>;
  exitNormalMode: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>;
  vimModeChange: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>;
}>;

const cursorCache = new Map<string, object>();

export function ItemBodyMarkdownEditor(props: ItemBodyMarkdownEditorProps) {
  const editorParentRef = useRef<HTMLDivElement | null>(null);
  const [, setSaveState] = useState<MarkdownBodySaveState>("saved");
  const callbacks = useEditorCallbackRefs(props);
  useCodeMirrorEditorView(editorParentRef, props, callbacks, setSaveState);
  return <EditorMount ref={editorParentRef} readOnly={props.readOnly === true} />;
}

function EditorMount({ ref, readOnly }: Readonly<{
  ref: RefObject<HTMLDivElement | null>;
  readOnly: boolean;
}>) {
  const className = readOnly
    ? "inbox-detail__codemirror inbox-detail__codemirror--preview"
    : "inbox-detail__codemirror";
  return <div className="inbox-detail__markdown-editor"><div ref={ref} className={className} /></div>;
}

function useEditorCallbackRefs(props: ItemBodyMarkdownEditorProps): EditorCallbackRefs {
  return {
    autosave: useLatestCallbackRef(props.onAutosave),
    save: useLatestCallbackRef(props.onSave),
    exitNormalMode: useLatestCallbackRef(props.onExitNormalMode),
    vimModeChange: useLatestCallbackRef(props.onVimModeChange)
  };
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

type EditorExtensionContext = Readonly<{
  viewRef: MutableRefObject<EditorView | null>;
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>;
  callbacks: Pick<EditorCallbackRefs, "save" | "exitNormalMode" | "vimModeChange">;
}>;

function createEditorExtensions(
  props: ItemBodyMarkdownEditorProps,
  body: ItemBody,
  context: EditorExtensionContext
) {
  const readOnly = props.readOnly === true;
  const interaction = readOnly ? [] : createEditingExtensions(props.itemId, context);
  return [
    itemBodyStateField.init(() => body),
    itemDocumentIdFacet.of(props.itemId),
    markdown({ base: markdownLanguage, addKeymap: false }),
    livePreviewPlugin,
    headingFoldingExtension(),
    lineNumbers(),
    EditorView.lineWrapping,
    ...editorModeExtensions(readOnly, interaction)
  ];
}

function createEditingExtensions(
  itemId: string,
  context: EditorExtensionContext
): Extension[] {
  const { viewRef, persistenceRef, callbacks } = context;
  return [
    vim(), history(), drawSelection(), highlightActiveLine(),
    yankHighlightExtension, vimClipboardPasteExtension,
    createEditingUpdateListener(itemId, persistenceRef, callbacks.vimModeChange),
    createEditingDomHandlers(viewRef, persistenceRef, callbacks.save, callbacks.exitNormalMode),
    createEditingControlKeymap(),
    createEditingShortcutKeymap(viewRef, persistenceRef),
    keymap.of([...historyKeymap, ...buildVimAwareDefaultKeymap()])
  ];
}

function createEditingUpdateListener(
  itemId: string,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>
) {
  return EditorView.updateListener.of((update) => {
    if (update.selectionSet || update.docChanged) {
      cursorCache.set(itemId, update.state.selection.toJSON());
    }
    handleEditorUpdate(update.view, update.docChanged, false, persistenceRef, onVimModeChangeRef);
  });
}

function createEditingDomHandlers(
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>
) {
  return EditorView.domEventHandlers({
    focus: () => registerEditorFocus(viewRef),
    blur: () => clearEditorFocus(viewRef),
    keydown: (event, view) => handleEditorKeydown(
      event,
      view,
      false,
      persistenceRef,
      onSaveRef,
      onExitNormalModeRef
    )
  });
}

function registerEditorFocus(viewRef: MutableRefObject<EditorView | null>): false {
  if (viewRef.current) registerActiveEditorView(viewRef.current);
  return false;
}

function clearEditorFocus(viewRef: MutableRefObject<EditorView | null>): false {
  if (viewRef.current && getActiveEditorView() === viewRef.current) registerActiveEditorView(null);
  return false;
}

function createEditingControlKeymap() {
  return Prec.highest(keymap.of([
    { key: "Enter", run: handleListContinuationEnter },
    { key: "Mod-Enter", run: toggleCheckbox },
    { key: "Backspace", run: applyFormattingBackspace }
  ]));
}

function applyFormattingBackspace(view: EditorView): boolean {
  const transaction = formatMarkerBackspaceTransaction(view.state);
  if (!transaction) return false;
  view.dispatch(transaction);
  return true;
}

function createEditingShortcutKeymap(
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>
) {
  return Prec.high(keymap.of([
    ...buildZenEditorKeymap(false),
    { key: "Mod-s", run: () => saveFromKeybind(viewRef, persistenceRef) }
  ]));
}

function saveFromKeybind(
  viewRef: RefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>
): boolean {
  if (!viewRef.current || !persistenceRef.current) return false;
  void persistenceRef.current.flush(viewRef.current.state.field(itemBodyStateField));
  return true;
}

function handleEditorKeydown(
  e: KeyboardEvent,
  v: EditorView,
  readOnly: boolean | undefined,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>
): boolean {
  const isEscape = e.key === "Escape";
  const isCtrlH = e.key === "h" && e.ctrlKey;
  if (readOnly || (!isEscape && !isCtrlH) || getCM(v)?.state?.vim?.insertMode !== false) {
    return false;
  }
  e.preventDefault();
  void flushAndExitOnNormalMode(v, persistenceRef.current, onSaveRef.current, onExitNormalModeRef.current);
  return true;
}

function useCodeMirrorEditorView(
  editorParentRef: RefObject<HTMLDivElement | null>,
  props: ItemBodyMarkdownEditorProps,
  callbacks: EditorCallbackRefs,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  const viewRef = useRef<EditorView | null>(null);
  const persistenceRef = useRef<ItemBodyPersistenceQueue | null>(null);
  const readOnlyRef = useRef<boolean | null>(null);
  useEditorMount(editorParentRef, props, callbacks, viewRef, persistenceRef, readOnlyRef, setSaveState);
  useEditorModeEffect(props, callbacks, viewRef, persistenceRef, readOnlyRef, setSaveState);
  usePreviewBodyEffect(props, viewRef);
  useEffect(() => registerEditorEventHandlers(viewRef), []);
}

function useEditorMount(
  parentRef: RefObject<HTMLDivElement | null>,
  props: ItemBodyMarkdownEditorProps,
  callbacks: EditorCallbackRefs,
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  readOnlyRef: MutableRefObject<boolean | null>,
  setSaveState: (state: MarkdownBodySaveState) => void
): void {
  useEffect(() => mountEditor(
    parentRef, props, callbacks, viewRef, persistenceRef, readOnlyRef, setSaveState
  ), [props.itemId]);
}

function mountEditor(
  parentRef: RefObject<HTMLDivElement | null>,
  props: ItemBodyMarkdownEditorProps,
  callbacks: EditorCallbackRefs,
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  readOnlyRef: MutableRefObject<boolean | null>,
  setSaveState: (state: MarkdownBodySaveState) => void
): (() => void) | undefined {
  if (!parentRef.current) return;
  const body = normalizeBodyForClient(props.initialBody);
  const readOnly = props.readOnly === true;
  prepareInitialEditing(readOnly, callbacks, persistenceRef, setSaveState);
  const view = createMountedEditor(parentRef.current, props, body, viewRef, persistenceRef, callbacks);
  viewRef.current = view;
  readOnlyRef.current = readOnly;
  if (!readOnly) activateEditingView(view, callbacks.vimModeChange);
  return () => destroyMountedEditor(view, viewRef, persistenceRef, readOnlyRef);
}

function prepareInitialEditing(
  readOnly: boolean,
  callbacks: EditorCallbackRefs,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  setSaveState: (state: MarkdownBodySaveState) => void
): void {
  if (readOnly) return;
  initVimExtensions();
  persistenceRef.current = createEditorPersistenceQueue(callbacks.autosave, callbacks.save, setSaveState);
}

function createMountedEditor(
  parent: HTMLDivElement,
  props: ItemBodyMarkdownEditorProps,
  body: ItemBody,
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  callbacks: EditorCallbackRefs
): EditorView {
  const selection = props.readOnly ? undefined : restoreCachedSelection(props.itemId, body.text.length);
  const extensions = createEditorExtensions(props, body, {
    viewRef,
    persistenceRef,
    callbacks
  });
  return new EditorView({
    parent,
    state: EditorState.create({ doc: body.text, selection, extensions })
  });
}

function destroyMountedEditor(
  view: EditorView,
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  readOnlyRef: MutableRefObject<boolean | null>
): void {
  if (getActiveEditorView() === view) registerActiveEditorView(null);
  void persistenceRef.current?.flush();
  persistenceRef.current = null;
  readOnlyRef.current = null;
  view.destroy();
  viewRef.current = null;
}

function useEditorModeEffect(
  props: ItemBodyMarkdownEditorProps,
  callbacks: EditorCallbackRefs,
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  readOnlyRef: MutableRefObject<boolean | null>,
  setSaveState: (state: MarkdownBodySaveState) => void
): void {
  useEffect(() => applyEditorMode(
    props, callbacks, viewRef, persistenceRef, readOnlyRef, setSaveState
  ), [props.readOnly]);
}

function applyEditorMode(
  props: ItemBodyMarkdownEditorProps,
  callbacks: EditorCallbackRefs,
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  readOnlyRef: MutableRefObject<boolean | null>,
  setSaveState: (state: MarkdownBodySaveState) => void
): void {
  const view = viewRef.current;
  const readOnly = props.readOnly === true;
  if (!view || readOnlyRef.current === readOnly) return;
  reconfigureEditorMode(
    view, readOnly, props.itemId, viewRef, persistenceRef, callbacks, setSaveState
  );
  readOnlyRef.current = readOnly;
}

function usePreviewBodyEffect(
  props: ItemBodyMarkdownEditorProps,
  viewRef: MutableRefObject<EditorView | null>
): void {
  useEffect(() => {
    if (!props.readOnly || !viewRef.current) return;
    syncReadOnlyBody(viewRef.current, normalizeBodyForClient(props.initialBody));
  }, [props.initialBody, props.readOnly, props.itemId]);
}

function createEditorPersistenceQueue(
  onAutosaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onAutosave"]>,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
): ItemBodyPersistenceQueue {
  return createItemBodyPersistenceQueue({
    persist: async (snapshot) => {
      const callback = onAutosaveRef.current ?? onSaveRef.current;
      if (callback) await callback(snapshot);
    },
    onStateChange: setSaveState
  });
}

function reconfigureEditorMode(
  view: EditorView,
  readOnly: boolean,
  itemId: string,
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  callbacks: EditorCallbackRefs,
  setSaveState: (state: MarkdownBodySaveState) => void
): void {
  prepareModePersistence(readOnly, callbacks, persistenceRef, setSaveState, view);
  const interaction = modeInteractionExtensions(
    readOnly, itemId, viewRef, persistenceRef, callbacks
  );
  const selection = readOnly ? undefined : restoreCachedSelection(itemId, view.state.doc.length);
  reconfigureEditorCompartments(view, readOnly, interaction, selection);
  if (!readOnly) activateEditingView(view, callbacks.vimModeChange);
}

function prepareModePersistence(
  readOnly: boolean,
  callbacks: EditorCallbackRefs,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  setSaveState: (state: MarkdownBodySaveState) => void,
  view: EditorView
): void {
  if (readOnly) return deactivateEditingView(view, persistenceRef);
  initVimExtensions();
  persistenceRef.current ??= createEditorPersistenceQueue(callbacks.autosave, callbacks.save, setSaveState);
}

function modeInteractionExtensions(
  readOnly: boolean,
  itemId: string,
  viewRef: MutableRefObject<EditorView | null>,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  callbacks: EditorCallbackRefs
): Extension[] {
  if (readOnly) return [];
  return createEditingExtensions(itemId, { viewRef, persistenceRef, callbacks });
}

function activateEditingView(
  view: EditorView,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>
): void {
  view.focus();
  registerActiveEditorView(view);
  setupVimModeTracker(view, onVimModeChangeRef);
}

function deactivateEditingView(
  view: EditorView,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>
): void {
  if (getActiveEditorView() === view) registerActiveEditorView(null);
  const persistence = persistenceRef.current;
  persistenceRef.current = null;
  if (persistence) void persistence.flush();
  delete view.contentDOM.dataset.vimMode;
}

function setupVimModeTracker(
  view: EditorView,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>
): void {
  const cm = getCM(view);
  publishVimMode(view, cm?.state?.vim?.insertMode ? "INSERT" : "NORMAL", onVimModeChangeRef);
  cm?.on("vim-mode-change", (event: { mode?: string }) => {
    const mode = (event.mode?.toUpperCase() ?? "NORMAL") as "NORMAL" | "INSERT" | "VISUAL";
    publishVimMode(view, mode, onVimModeChangeRef);
    scheduleLivePreviewRefresh(view);
  });
}

function publishVimMode(
  view: EditorView,
  mode: "NORMAL" | "INSERT" | "VISUAL",
  callbackRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>
): void {
  view.contentDOM.dataset.vimMode = mode.toLowerCase();
  callbackRef.current?.(mode);
}

function scheduleLivePreviewRefresh(view: EditorView): void {
  queueMicrotask(() => {
    try {
      view.dispatch({ effects: refreshLivePreviewEffect.of() });
    } catch {
      // The view can be destroyed between Vim's event and this microtask.
    }
  });
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
  const currentBody = view.state.field(itemBodyStateField);
  const entity = blockEntityFromInsertedAsset(detail, range.from, markdown.length);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: markdown },
    effects: itemBodyStateEffect.of({
      ...currentBody,
      blockEntities: [...currentBody.blockEntities, entity]
    }),
    selection: EditorSelection.cursor(range.from + markdown.length)
  });
  setTimeout(() => view.focus(), 0);
}

function blockEntityFromInsertedAsset(
  detail: InsertBlockEntityEventDetail,
  from: number,
  markdownLength: number
): ItemBody["blockEntities"][number] {
  return {
    id: crypto.randomUUID(),
    type: detail.image ? "image" : "file",
    from,
    to: from + markdownLength,
    assetId: detail.assetId,
    attrs: {
      displayName: detail.displayName,
      contentType: detail.contentType,
      relativePath: detail.relativePath,
      url: detail.url
    }
  };
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

function handleEditorUpdate(
  view: EditorView,
  docChanged: boolean,
  readOnly: boolean,
  persistenceRef: MutableRefObject<ItemBodyPersistenceQueue | null>,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>
): void {
  syncVimMode(view, onVimModeChangeRef);
  if (readOnly || !docChanged || !persistenceRef.current) return;
  persistenceRef.current.queue(view.state.field(itemBodyStateField));
}

function syncVimMode(
  view: EditorView,
  onVimModeChangeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onVimModeChange"]>
): void {
  const vimState = getCM(view)?.state?.vim;
  const mode = vimState?.insertMode ? "INSERT" : (vimState?.visualMode ? "VISUAL" : "NORMAL");
  view.contentDOM.dataset.vimMode = mode.toLowerCase();
  onVimModeChangeRef.current?.(mode);
}

async function flushAndExitOnNormalMode(
  view: EditorView,
  persistence: ItemBodyPersistenceQueue | null,
  onSave: ItemBodyMarkdownEditorProps["onSave"] | undefined,
  onExitNormalMode: ItemBodyMarkdownEditorProps["onExitNormalMode"] | undefined
): Promise<void> {
  const body = bodyForPersistence(view.state.field(itemBodyStateField));
  const persistenceResult = persistence?.flush(body) ?? onSave?.(body) ?? Promise.resolve();
  void persistenceResult.catch((error: unknown) => {
    console.error("Failed to persist item body while leaving the editor", error);
  });
  if (onExitNormalMode) await onExitNormalMode(body);
}
