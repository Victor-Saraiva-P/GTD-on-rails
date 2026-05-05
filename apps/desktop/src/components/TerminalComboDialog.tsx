import { useEffect, useRef, type FormEvent, type RefObject } from "react";

export type TerminalComboDialogProps = {
  title: string;
  label: string;
  value: string;
  placeholder?: string;
  confirmKey: string;
  confirmLabel: string;
  cancelLabel?: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function TerminalComboCommands(props: Pick<TerminalComboDialogProps, "confirmKey" | "confirmLabel" | "cancelLabel">) {
  return (
    <div className="terminal-combo__commands">
      <span>
        <kbd>{props.confirmKey}</kbd> {props.confirmLabel}
      </span>
      <span>{props.cancelLabel ?? "Esc Cancel"}</span>
    </div>
  );
}

/**
 * Renders a reusable terminal-style prompt for leader-key combos.
 *
 * @example <TerminalComboDialog title="Link" label="URL" value={url} onConfirm={save} ... />
 */
export function TerminalComboDialog(props: TerminalComboDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(activeElement());

  useEffect(() => focusComboInput(inputRef, previousFocusRef), []);
  useEffect(() => bindComboKeys(props), [props]);

  return (
    <div className="terminal-combo" role="dialog" aria-modal="true" aria-label={props.title}>
      <form className="terminal-combo__panel" onSubmit={(event) => submitComboForm(event, props.onConfirm)}>
        <h2 className="terminal-combo__title">{props.title}</h2>
        <label className="terminal-combo__field">
          <span>{props.label}</span>
          <input ref={inputRef} value={props.value} placeholder={props.placeholder} onChange={(event) => props.onChange(event.target.value)} />
        </label>
        <TerminalComboCommands {...props} />
      </form>
    </div>
  );
}

function submitComboForm(event: FormEvent<HTMLFormElement>, onConfirm: () => void) {
  event.preventDefault();
  onConfirm();
}

function activeElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function focusComboInput(
  inputRef: RefObject<HTMLInputElement | null>,
  previousFocusRef: RefObject<HTMLElement | null>
) {
  inputRef.current?.focus();
  return () => previousFocusRef.current?.focus();
}

function bindComboKeys(props: TerminalComboDialogProps) {
  const onKeyDown = (event: KeyboardEvent) => handleComboKeyDown(event, props);
  window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}

function handleComboKeyDown(event: KeyboardEvent, props: TerminalComboDialogProps) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    props.onCancel();
    return;
  }

  if (shouldConfirmFromKey(event, props)) {
    event.preventDefault();
    event.stopPropagation();
    props.onConfirm();
  }
}

function shouldConfirmFromKey(event: KeyboardEvent, props: TerminalComboDialogProps): boolean {
  if (event.key.toLowerCase() !== props.confirmKey.toLowerCase()) {
    return false;
  }

  if (!(event.target instanceof HTMLInputElement)) {
    return true;
  }

  return props.value.trim().length === 0 || isCompleteUrlValue(props.value);
}

function isCompleteUrlValue(value: string): boolean {
  return /^https?:\/\/.+\..+/.test(value.trim());
}
