import { CodeMirror, Vim } from "@replit/codemirror-vim";

export interface VimMotionState {
  visualLine?: boolean;
  visualBlock?: boolean;
  lastMotion?: unknown;
  lastHSPos?: number;
  lastHPos?: number;
  inputState?: { operator?: unknown };
}

export interface VimMotionInputState {
  prefixRepeat?: readonly unknown[];
  motionRepeat?: readonly unknown[];
}

export interface VimMotionCm {
  firstLine: () => number;
  lastLine: () => number;
  findPosV: (
    start: { line: number; ch: number },
    amount: number,
    unit: string,
    goalColumn?: number
  ) => { line: number; ch: number };
  charCoords: (pos: { line: number; ch: number }, mode: string) => { left: number };
}

export interface VimDisplayBoundaryCm {
  firstLine?: () => number;
  lastLine?: () => number;
  execCommand: (command: string) => void;
  getCursor: () => { line: number; ch: number; sticky?: string };
}

export interface VimActionTable {
  enterInsertMode: (
    cm: unknown,
    args: {
      head: { line: number; ch: number };
      insertAt: "inplace";
      repeat?: number;
    },
    vim: unknown
  ) => void;
}

export function isCountTyped(
  explicit?: boolean,
  inputState?: VimMotionInputState
): boolean {
  if (explicit) return true;
  const prefix = inputState?.prefixRepeat?.length ?? 0;
  const motion = inputState?.motionRepeat?.length ?? 0;
  return prefix > 0 || motion > 0;
}

export function shouldMoveByLogicalLine(
  vim: VimMotionState,
  countWasTyped: boolean
): boolean {
  if (vim.visualLine || vim.visualBlock) return true;
  if (vim.inputState?.operator) return true;
  return countWasTyped;
}

export function computeLogicalTarget(
  firstLine: number,
  lastLine: number,
  currentLine: number,
  repeat: number,
  forward: boolean
): number {
  const delta = forward ? repeat : -repeat;
  return Math.max(firstLine, Math.min(lastLine, currentLine + delta));
}

function runDisplayLineStep(
  cm: VimMotionCm,
  head: { line: number; ch: number },
  repeat: number,
  forward: boolean,
  vim: VimMotionState
): { line: number; ch: number } {
  if (vim.lastMotion !== moveByDisplayLineMotion) {
    vim.lastHSPos = cm.charCoords(head, "div").left;
  }
  const amount = forward ? repeat : -repeat;
  const res = cm.findPosV(head, amount, "line", vim.lastHSPos);
  vim.lastHPos = res.ch;
  return res;
}

/**
 * Moves cursor vertically by display line for wrapped text, falling back to logical line for counts.
 *
 * @example moveByDisplayLineMotion(cm, head, { forward: true }, vim)
 */
export function moveByDisplayLineMotion(
  cm: VimMotionCm,
  head: { line: number; ch: number },
  motionArgs: { forward?: boolean; repeat?: number; repeatIsExplicit?: boolean },
  vim: VimMotionState,
  inputState?: VimMotionInputState
): { line: number; ch: number } {
  const forward = Boolean(motionArgs.forward);
  const repeat = motionArgs.repeat || 1;
  const countWasTyped = isCountTyped(motionArgs.repeatIsExplicit, inputState);
  const target = computeLogicalTarget(cm.firstLine(), cm.lastLine(), head.line, repeat, forward);

  if (shouldMoveByLogicalLine(vim, countWasTyped)) {
    return new CodeMirror.Pos(target, head.ch);
  }
  try {
    return runDisplayLineStep(cm, head, repeat, forward, vim);
  } catch {
    return new CodeMirror.Pos(target, head.ch);
  }
}

function resolveBoundaryFallback(
  head: { line: number; ch: number },
  forward: boolean
): { line: number; ch: number } {
  return forward ? new CodeMirror.Pos(head.line, Infinity) : new CodeMirror.Pos(head.line, 0);
}

/**
 * Moves cursor to the display line boundary (start or end of current visual row).
 *
 * @example moveToDisplayBoundaryMotion(cm, head, { forward: true })
 */
export function moveToDisplayBoundaryMotion(
  cm: VimDisplayBoundaryCm,
  head: { line: number; ch: number },
  motionArgs: { forward?: boolean; repeat?: number }
): { line: number; ch: number } {
  const forward = Boolean(motionArgs.forward);
  const repeat = motionArgs.repeat || 1;
  if (forward && repeat > 1) {
    const last = cm.lastLine?.() ?? head.line + repeat - 1;
    return new CodeMirror.Pos(Math.min(last, head.line + repeat - 1), Infinity);
  }
  try {
    cm.execCommand(forward ? "goLineRight" : "goLineLeft");
    const target = cm.getCursor();
    const ch = forward && target.sticky === "before" ? target.ch - 1 : target.ch;
    return new CodeMirror.Pos(target.line, Math.max(0, ch));
  } catch {
    return resolveBoundaryFallback(head, forward);
  }
}

function resolveInsertTarget(
  cm: VimDisplayBoundaryCm,
  cursor: { line: number; ch: number },
  forward: boolean
): { line: number; ch: number } {
  if (!forward) {
    return moveToDisplayBoundaryMotion(cm, cursor, { forward: false });
  }
  try {
    cm.execCommand("goLineRight");
    return cm.getCursor();
  } catch {
    return cursor;
  }
}

/**
 * Enters insert mode at the display line boundary.
 *
 * @example enterInsertAtDisplayBoundaryAction.call(actionTable, cm, { forward: true }, vim)
 */
export function enterInsertAtDisplayBoundaryAction(
  this: VimActionTable,
  cm: VimDisplayBoundaryCm,
  actionArgs: { forward?: boolean; repeat?: number },
  vim: unknown
): void {
  const cursor = cm.getCursor();
  const forward = Boolean(actionArgs.forward);
  const target = resolveInsertTarget(cm, cursor, forward);
  this.enterInsertMode(cm, { head: target, insertAt: "inplace", repeat: actionArgs.repeat }, vim);
}

let displayLinesRegistered = false;

function mapBoundaryCommands(): void {
  const contexts = ["normal", "visual", "operatorPending"] as const;
  for (const context of contexts) {
    Vim.mapCommand("$", "motion", "gtdMoveToDisplayLineBoundary", { forward: true, inclusive: true }, { context });
    Vim.mapCommand("g0", "motion", "gtdMoveToDisplayLineBoundary", { forward: false }, { context });
  }
}

/**
 * Registers display-line navigation motions and boundary actions in CodeMirror Vim.
 *
 * @example registerDisplayLineMotions()
 */
export function registerDisplayLineMotions(): void {
  if (displayLinesRegistered) return;
  displayLinesRegistered = true;

  Vim.defineMotion("gtdMoveByDisplayLine", moveByDisplayLineMotion as never);
  Vim.defineMotion("gtdMoveToDisplayLineBoundary", moveToDisplayBoundaryMotion as never);
  Vim.defineAction("gtdEnterInsertAtDisplayLineBoundary", enterInsertAtDisplayBoundaryAction as never);

  for (const context of ["normal", "visual"] as const) {
    Vim.mapCommand("j", "motion", "gtdMoveByDisplayLine", { forward: true, linewise: true }, { context });
    Vim.mapCommand("k", "motion", "gtdMoveByDisplayLine", { forward: false, linewise: true }, { context });
  }
  mapBoundaryCommands();
  Vim.mapCommand("A", "action", "gtdEnterInsertAtDisplayLineBoundary", { forward: true }, { context: "normal", isEdit: true });
  Vim.mapCommand("I", "action", "gtdEnterInsertAtDisplayLineBoundary", { forward: false }, { context: "normal", isEdit: true });
}
