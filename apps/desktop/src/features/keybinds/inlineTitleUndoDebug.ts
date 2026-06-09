type KeyboardDebugEvent = Readonly<{
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  inputType?: string;
  key?: string;
  phase: string;
  selectionEnd?: number | null;
  selectionStart?: number | null;
  shiftKey?: boolean;
  target?: string;
  value?: string;
}>;

function inlineTitleUndoDebugEnabled(): boolean {
  return window.localStorage.getItem("gtdDebugInlineTitleUndo") === "true";
}

/**
 * Emits opt-in diagnostics for inline title native undo handling.
 *
 * @example logInlineTitleUndoDebug({ phase: "keydown", key: "z" })
 */
export function logInlineTitleUndoDebug(event: KeyboardDebugEvent): void {
  if (!inlineTitleUndoDebugEnabled()) return;
  console.info(JSON.stringify({ component: "inline-title-undo", ...event }));
}
