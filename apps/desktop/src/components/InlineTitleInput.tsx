import { type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactElement, useRef } from "react";

type InlineTitleInputProps = Readonly<{
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

function handleTitleInput(event: FormEvent<HTMLInputElement>, history: TitleInputHistory): void {
  const nativeEvent = event.nativeEvent as NativeInputEvent;
  recordGroupedTitleInputValue(history, event.currentTarget.value, nativeEvent.inputType);
}

function handleTitleChange(event: ChangeEvent<HTMLInputElement>, props: InlineTitleInputProps): void {
  props.onValueChange(event.target.value);
}

function handleTitleBlur(event: FormEvent<HTMLInputElement>, props: InlineTitleInputProps): void {
  props.onBlur();
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
      onInput={(event) => handleTitleInput(event, historyRef.current)}
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
