import { type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactElement, useRef } from "react";
import { logInlineTitleUndoDebug } from "../features/keybinds/inlineTitleUndoDebug";

type InlineTitleInputProps = Readonly<{
  debugPhasePrefix: string;
  initialValue: string;
  onBlur: () => void;
  onEditKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onValueChange: (value: string) => void;
}>;

type TitleInputHistory = {
  current: string;
  future: string[];
  openTypingGroup: boolean;
  past: string[];
};

type NativeInputEvent = Event & {
  inputType?: string;
};

function applyTitleInputValue(input: HTMLInputElement, history: TitleInputHistory, value: string): void {
  input.value = value;
  history.current = value;
  input.setSelectionRange(value.length, value.length);
}

function recordGroupedTitleInputValue(history: TitleInputHistory, value: string, inputType?: string): void {
  if (value === history.current) return;
  if (inputType === "insertText" && history.openTypingGroup) {
    history.current = value;
    history.future = [];
    return;
  }
  history.past.push(history.current);
  history.current = value;
  history.openTypingGroup = inputType === "insertText";
  history.future = [];
}

function undoTitleInput(input: HTMLInputElement, history: TitleInputHistory): string | null {
  const previous = history.past.pop();
  if (previous === undefined) return null;
  history.openTypingGroup = false;
  history.future.push(history.current);
  applyTitleInputValue(input, history, previous);
  return previous;
}

function redoTitleInput(input: HTMLInputElement, history: TitleInputHistory): string | null {
  const next = history.future.pop();
  if (next === undefined) return null;
  history.openTypingGroup = false;
  history.past.push(history.current);
  applyTitleInputValue(input, history, next);
  return next;
}

function isUndoKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "z";
}

function isRedoKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.ctrlKey && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));
}

function logTitleKeyDown(event: KeyboardEvent<HTMLInputElement>, phase: string): void {
  logInlineTitleUndoDebug({
    ctrlKey: event.ctrlKey,
    defaultPrevented: event.defaultPrevented,
    key: event.key,
    phase,
    selectionEnd: event.currentTarget.selectionEnd,
    selectionStart: event.currentTarget.selectionStart,
    shiftKey: event.shiftKey,
    value: event.currentTarget.value
  });
}

function handleTitleInput(event: FormEvent<HTMLInputElement>, props: InlineTitleInputProps, history: TitleInputHistory): void {
  const nativeEvent = event.nativeEvent as NativeInputEvent;
  recordGroupedTitleInputValue(history, event.currentTarget.value, nativeEvent.inputType);
  logInlineTitleUndoDebug({ inputType: nativeEvent.inputType, phase: `${props.debugPhasePrefix}-input`, value: event.currentTarget.value });
}

function handleTitleChange(event: ChangeEvent<HTMLInputElement>, props: InlineTitleInputProps): void {
  logInlineTitleUndoDebug({ phase: `${props.debugPhasePrefix}-change`, value: event.target.value });
  props.onValueChange(event.target.value);
}

function handleTitleBlur(event: FormEvent<HTMLInputElement>, props: InlineTitleInputProps): void {
  logInlineTitleUndoDebug({ phase: `${props.debugPhasePrefix}-blur`, value: event.currentTarget.value });
  props.onBlur();
}

function handleTitleBeforeInput(event: FormEvent<HTMLInputElement>, props: InlineTitleInputProps): void {
  const nativeEvent = event.nativeEvent as NativeInputEvent;
  logInlineTitleUndoDebug({ inputType: nativeEvent.inputType, phase: `${props.debugPhasePrefix}-beforeinput`, value: event.currentTarget.value });
}

/**
 * Renders a native-looking title input with a local undo buffer for webviews without input history.
 *
 * @example <InlineTitleInput initialValue="Inbox title" onValueChange={setTitle} ... />
 */
export function InlineTitleInput(props: InlineTitleInputProps): ReactElement {
  const historyRef = useRef<TitleInputHistory>({ current: props.initialValue, future: [], openTypingGroup: false, past: [] });

  return (
    <input
      defaultValue={props.initialValue}
      className="tree-entry__input"
      onBeforeInput={(event) => handleTitleBeforeInput(event, props)}
      onInput={(event) => handleTitleInput(event, props, historyRef.current)}
      onChange={(event) => handleTitleChange(event, props)}
      onBlur={(event) => handleTitleBlur(event, props)}
      onKeyDown={(event) => handleTitleKeyDown(event, props, historyRef.current)}
      autoFocus
    />
  );
}

function handleTitleKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  props: InlineTitleInputProps,
  history: TitleInputHistory
): void {
  logTitleKeyDown(event, `${props.debugPhasePrefix}-keydown`);
  const nextValue = isUndoKey(event) ? undoTitleInput(event.currentTarget, history) : redoValueForKey(event, history);
  if (nextValue === null) {
    props.onEditKeyDown(event);
    return;
  }
  event.preventDefault();
  props.onValueChange(nextValue);
}

function redoValueForKey(event: KeyboardEvent<HTMLInputElement>, history: TitleInputHistory): string | null {
  if (!isRedoKey(event)) return null;
  return redoTitleInput(event.currentTarget, history);
}
