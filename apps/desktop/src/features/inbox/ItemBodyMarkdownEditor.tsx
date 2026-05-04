import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { getCM, vim } from "@replit/codemirror-vim";
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
      if (readOnly || event.key !== "Escape" || !isVimNormalMode(view)) {
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
