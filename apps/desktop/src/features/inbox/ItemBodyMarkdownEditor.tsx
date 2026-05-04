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

type ItemBodyMarkdownEditorProps = {
  itemId: string;
  initialBody: string | null | undefined;
  onSave?: (body: string) => Promise<void>;
  onExitNormalMode?: (body: string) => Promise<void>;
  readOnly?: boolean;
};

type ItemBodyMarkdownEditorFrameProps = {
  editorParentRef: RefObject<HTMLDivElement | null>;
  saveState: MarkdownBodySaveState;
};

function normalizedInitialBody(initialBody: string | null | undefined): string {
  try {
    return normalizeMarkdownBody(initialBody);
  } catch {
    return "";
  }
}

function SaveStateBadge({ saveState }: Pick<ItemBodyMarkdownEditorFrameProps, "saveState">) {
  return <span className={`inbox-detail__save-state inbox-detail__save-state--${saveState}`}>{saveState}</span>;
}

function ItemBodyMarkdownEditorFrame(props: ItemBodyMarkdownEditorFrameProps) {
  return (
    <div className="inbox-detail__markdown-editor">
      <div ref={props.editorParentRef} className="inbox-detail__codemirror" />
      <SaveStateBadge saveState={props.saveState} />
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
  const [saveState, setSaveState] = useState<MarkdownBodySaveState>("saved");
  const onSaveRef = useLatestCallbackRef(props.onSave);
  const onExitNormalModeRef = useLatestCallbackRef(props.onExitNormalMode);

  useCodeMirrorEditorView(editorParentRef, props, onSaveRef, onExitNormalModeRef, setSaveState);

  return <ItemBodyMarkdownEditorFrame editorParentRef={editorParentRef} saveState={saveState} />;
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
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  const editorViewRef = useRef<EditorView | null>(null);
  useEffect(() => {
    return mountEditorView(editorParentRef.current, editorViewRef, props, onSaveRef, onExitNormalModeRef, setSaveState);
  }, [props.itemId, props.readOnly]);
}

function mountEditorView(
  parent: HTMLDivElement | null,
  editorViewRef: MutableRefObject<EditorView | null>,
  props: ItemBodyMarkdownEditorProps,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  if (!parent) {
    return undefined;
  }

  const view = createEditorView(parent, props, onSaveRef, onExitNormalModeRef, setSaveState);
  editorViewRef.current = view;
  focusEditableEditorView(view, props.readOnly === true);
  return () => destroyEditorView(view, editorViewRef);
}

function focusEditableEditorView(view: EditorView, readOnly: boolean) {
  if (!readOnly) {
    view.focus();
  }
}

function destroyEditorView(view: EditorView, editorViewRef: MutableRefObject<EditorView | null>) {
  view.destroy();
  editorViewRef.current = null;
}

function createEditorView(
  parent: HTMLDivElement,
  props: ItemBodyMarkdownEditorProps,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: normalizedInitialBody(props.initialBody),
      extensions: editorExtensions(props.readOnly === true, onSaveRef, onExitNormalModeRef, setSaveState)
    })
  });
}

function editorExtensions(
  readOnly: boolean,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return [
    vim(),
    ...editorBehaviorExtensions(readOnly, onSaveRef, onExitNormalModeRef, setSaveState),
    ...editorKeymapExtensions(onSaveRef, setSaveState)
  ];
}

function editorBehaviorExtensions(
  readOnly: boolean,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
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
    EditorView.updateListener.of((update) => update.docChanged && setSaveState("unsaved")),
    normalModeEscapeHandler(readOnly, onSaveRef, onExitNormalModeRef, setSaveState)
  ];
}

function normalModeEscapeHandler(
  readOnly: boolean,
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  onExitNormalModeRef: MutableRefObject<ItemBodyMarkdownEditorProps["onExitNormalMode"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return EditorView.domEventHandlers({
    keydown: (event, view) => {
      if (readOnly || event.key !== "Escape" || !isVimNormalMode(view)) {
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

function isVimNormalMode(view: EditorView): boolean {
  const cm = getCM(view);
  const vimState = cm?.state?.vim;
  return vimState != null && vimState.insertMode === false;
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
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return [
    keymap.of([{ key: "Mod-s", run: saveMarkdownBodyCommand(onSaveRef, setSaveState) }]),
    keymap.of([...historyKeymap, ...defaultKeymap])
  ];
}

function saveMarkdownBodyCommand(
  onSaveRef: MutableRefObject<ItemBodyMarkdownEditorProps["onSave"]>,
  setSaveState: (state: MarkdownBodySaveState) => void
) {
  return createSaveItemBodyCommand(
    async (body) => saveMarkdownBody(onSaveRef.current, body, setSaveState),
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
