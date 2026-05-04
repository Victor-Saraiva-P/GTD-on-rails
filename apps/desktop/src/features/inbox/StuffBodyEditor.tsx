import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { applyStuffBodyTextareaCommand } from "./stuffBodyRenderedCursor";
import {
  initialStuffBodyVimState,
  stuffBodyCursorCell,
  type StuffBodyVimMode,
  type StuffBodyVimState
} from "./stuffBodyVim";

type StuffBodyEditorProps = {
  value: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  onCommitEditing: () => void;
  onModeChange?: (mode: StuffBodyVimMode | null) => void;
  writeClipboardText?: (value: string) => void;
};

type EditingActions = Pick<StuffBodyEditorProps, "onChange" | "onCommitEditing" | "writeClipboardText">;

type EditorTextareaProps = StuffBodyEditorProps & {
  mode: StuffBodyVimMode;
  setVimState: (state: StuffBodyVimState) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  vimState: StuffBodyVimState;
  writeClipboardText: (value: string) => void;
};

type StuffBodyEditorFrameProps = {
  editorProps: EditorTextareaProps;
  value: string;
  vimState: StuffBodyVimState;
};

function writeNavigatorClipboardText(value: string): void {
  void navigator.clipboard?.writeText(value);
}

function useFocusEditingTextarea(textareaRef: RefObject<HTMLTextAreaElement | null>): void {
  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.focus();
    setTextareaSelection(textareaRef.current, initialStuffBodyVimState);
  }, [textareaRef]);
}

function useReportVimMode(mode: StuffBodyVimMode, onModeChange?: (mode: StuffBodyVimMode | null) => void): void {
  useEffect(() => {
    onModeChange?.(mode);
    return () => onModeChange?.(null);
  }, [mode, onModeChange]);
}

function handleTextareaKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  vimState: StuffBodyVimState,
  setVimState: (state: StuffBodyVimState) => void,
  actions: EditingActions
): void {
  if (commitFromKeyboardShortcut(event, actions.onCommitEditing)) {
    return;
  }

  applyTextareaKey(event, currentTextareaVimState(event.currentTarget, vimState), setVimState, actions);
}

function applyTextareaKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  currentState: StuffBodyVimState,
  setVimState: (state: StuffBodyVimState) => void,
  actions: EditingActions
): void {
  const command = { ...currentState, key: event.key, value: event.currentTarget.value };
  const update = applyStuffBodyTextareaCommand(command, event.currentTarget);

  if (!update.handled) {
    preventNativeEditOutsideInsertMode(event, currentState.mode);
    return;
  }

  event.preventDefault();
  actions.onChange(update.value);
  setVimState(update);
  setTextareaSelection(event.currentTarget, update);
  copyTextWhenPresent(update.copiedText, actions.writeClipboardText);
}

function commitFromKeyboardShortcut(event: KeyboardEvent<HTMLTextAreaElement>, onCommitEditing: () => void): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
    return false;
  }

  event.preventDefault();
  onCommitEditing();
  return true;
}

function currentTextareaVimState(textarea: HTMLTextAreaElement, vimState: StuffBodyVimState): StuffBodyVimState {
  return {
    ...vimState,
    activeCursor: currentTextareaActiveCursor(textarea, vimState),
    selectionEnd: textarea.selectionEnd,
    selectionStart: textarea.selectionStart
  };
}

function currentTextareaActiveCursor(textarea: HTMLTextAreaElement, vimState: StuffBodyVimState): number {
  return vimState.mode === "insert" ? textarea.selectionEnd : vimState.activeCursor;
}

function preventNativeEditOutsideInsertMode(event: KeyboardEvent<HTMLTextAreaElement>, mode: StuffBodyVimMode): void {
  if (mode !== "insert" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
  }
}

function setTextareaSelection(textarea: HTMLTextAreaElement, state: StuffBodyVimState): void {
  const selection = textareaSelectionRange(state);
  requestAnimationFrame(() => textarea.setSelectionRange(selection.start, selection.end));
}

function textareaSelectionRange(state: StuffBodyVimState): { end: number; start: number } {
  if (state.mode !== "normal") {
    return { end: state.selectionEnd, start: state.selectionStart };
  }

  return { end: state.activeCursor, start: state.activeCursor };
}

function copyTextWhenPresent(copiedText: string | null, writeClipboardText?: (value: string) => void): void {
  if (copiedText !== null) {
    writeClipboardText?.(copiedText);
  }
}

function normalModeCursorCharacter(value: string, vimState: StuffBodyVimState): string {
  return stuffBodyCursorCell(value, vimState.activeCursor).character;
}

function normalModeCursorPrefix(value: string, vimState: StuffBodyVimState): string {
  return value.slice(0, vimState.activeCursor);
}

function normalModeCursorSuffix(value: string, vimState: StuffBodyVimState): string {
  const cursorCharacter = value[vimState.activeCursor];
  const suffixStart = cursorCharacter === "\n" ? vimState.activeCursor : vimState.activeCursor + 1;
  return value.slice(suffixStart);
}

function NormalModeCursor(props: Pick<StuffBodyEditorProps, "value"> & { mode: StuffBodyVimMode; vimState: StuffBodyVimState }) {
  if (props.mode !== "normal") {
    return null;
  }

  return (
    <div className="inbox-detail__normal-cursor-layer" aria-hidden="true">
      <span className="inbox-detail__normal-cursor-prefix">{normalModeCursorPrefix(props.value, props.vimState)}</span>
      <span className="inbox-detail__normal-cursor" data-cursor-index={props.vimState.activeCursor}>
        {normalModeCursorCharacter(props.value, props.vimState)}
      </span>
      <span className="inbox-detail__normal-cursor-suffix">{normalModeCursorSuffix(props.value, props.vimState)}</span>
    </div>
  );
}

function EditorTextarea(props: EditorTextareaProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    handleTextareaKeyDown(event, props.vimState, props.setVimState, { ...props, writeClipboardText: props.writeClipboardText });
  };

  return (
    <textarea
      ref={props.textareaRef}
      value={props.value}
      className={`inbox-detail__textarea inbox-detail__textarea--${props.mode}`}
      onBlur={props.onBlur}
      onChange={(event) => props.onChange(event.target.value)}
      onKeyDown={handleKeyDown}
    />
  );
}

function StuffBodyEditorFrame(props: StuffBodyEditorFrameProps) {
  return (
    <div className="inbox-detail__editor">
      <EditorTextarea {...props.editorProps} />
      <NormalModeCursor mode={props.editorProps.mode} value={props.value} vimState={props.vimState} />
    </div>
  );
}

/**
 * Renders the stuff body textarea with the supported Vim-inspired modes.
 *
 * @example <StuffBodyEditor value="body" onChange={setBody} onBlur={save} onCommitEditing={save} />
 */
export function StuffBodyEditor(props: StuffBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [vimState, setVimState] = useState<StuffBodyVimState>(initialStuffBodyVimState);
  const writeClipboardText = props.writeClipboardText ?? writeNavigatorClipboardText;
  const editorProps = { ...props, mode: vimState.mode, setVimState, textareaRef, vimState, writeClipboardText };

  useFocusEditingTextarea(textareaRef);
  useReportVimMode(vimState.mode, props.onModeChange);

  return <StuffBodyEditorFrame editorProps={editorProps} value={props.value} vimState={vimState} />;
}
