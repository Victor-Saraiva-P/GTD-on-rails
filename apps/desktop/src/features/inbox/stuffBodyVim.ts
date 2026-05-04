export type StuffBodyVimMode = "normal" | "insert" | "visual" | "visual-line";

export type StuffBodyVimState = {
  activeCursor: number;
  mode: StuffBodyVimMode;
  selectionStart: number;
  selectionEnd: number;
  visualAnchor: number;
  pendingKey: string | null;
};

export type StuffBodyVimCommand = StuffBodyVimState & {
  key: string;
  value: string;
};

export type StuffBodyVimUpdate = StuffBodyVimState & {
  copiedText: string | null;
  handled: boolean;
  value: string;
};

export type StuffBodyCursorCell = {
  character: string;
  column: number;
  line: number;
};

export const initialStuffBodyVimState: StuffBodyVimState = {
  activeCursor: 0,
  mode: "normal",
  pendingKey: null,
  selectionEnd: 0,
  selectionStart: 0,
  visualAnchor: 0
};

/**
 * Formats a stuff body Vim mode for the footer mode badge.
 *
 * @example formatStuffBodyVimMode("visual-line")
 */
export function formatStuffBodyVimMode(mode: StuffBodyVimMode | null): string | null {
  return mode ? mode.toUpperCase().replace("-", " ") : null;
}

function clampCursor(value: string, cursor: number): number {
  return Math.min(Math.max(cursor, 0), value.length);
}

function clampNormalCursor(value: string, cursor: number): number {
  if (value.length === 0 || value.endsWith("\n")) {
    return clampCursor(value, cursor);
  }

  return Math.min(Math.max(cursor, 0), value.length - 1);
}

function lineIndex(value: string, cursor: number): number {
  return value.slice(0, clampNormalCursor(value, cursor)).split("\n").length - 1;
}

function currentLineStart(value: string, cursor: number): number {
  return value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
}

function currentLineEnd(value: string, cursor: number): number {
  const nextBreak = value.indexOf("\n", cursor);
  return nextBreak === -1 ? value.length : nextBreak;
}

function lineColumn(value: string, cursor: number): number {
  return cursor - currentLineStart(value, cursor);
}

/**
 * Describes the visible normal-mode cursor cell for a stuff body.
 *
 * @example stuffBodyCursorCell("one\n", 4)
 */
export function stuffBodyCursorCell(value: string, cursor: number): StuffBodyCursorCell {
  const safeCursor = clampNormalCursor(value, cursor);
  const character = value[safeCursor] && value[safeCursor] !== "\n" ? value[safeCursor] : " ";

  return { character, column: lineColumn(value, safeCursor), line: lineIndex(value, safeCursor) };
}

function cursorAtColumn(value: string, lineStart: number, column: number): number {
  return Math.min(lineStart + column, currentLineEnd(value, lineStart));
}

function verticalCursor(value: string, cursor: number, offset: -1 | 1): number {
  const edge = offset === 1 ? currentLineEnd(value, cursor) + 1 : currentLineStart(value, cursor) - 1;
  return edge < 0 || edge > value.length ? cursor : cursorAtColumn(value, currentLineStart(value, edge), lineColumn(value, cursor));
}

function lastLineStart(value: string): number {
  return currentLineStart(value, value.length);
}

function isWordCharacter(character: string): boolean {
  return /[A-Za-z0-9_]/.test(character);
}

function nextWordStart(value: string, cursor: number): number {
  let index = clampCursor(value, cursor + 1);

  while (index < value.length && isWordCharacter(value[index])) {
    index += 1;
  }

  return skipToWordStart(value, index);
}

function skipToWordStart(value: string, cursor: number): number {
  let index = cursor;

  while (index < value.length && !isWordCharacter(value[index])) {
    index += 1;
  }

  return clampCursor(value, index);
}

function previousWordStart(value: string, cursor: number): number {
  let index = clampCursor(value, cursor - 1);

  while (index > 0 && !isWordCharacter(value[index])) {
    index -= 1;
  }

  return scanBackToWordStart(value, index);
}

function scanBackToWordStart(value: string, cursor: number): number {
  let index = cursor;

  while (index > 0 && isWordCharacter(value[index - 1])) {
    index -= 1;
  }

  return index;
}

/**
 * Moves a stuff body cursor using the supported Vim navigation keys.
 *
 * @example moveStuffBodyCursor("one\ntwo", 0, "j")
 */
export function moveStuffBodyCursor(value: string, cursor: number, key: string): number {
  if (key === "h") {
    return clampNormalCursor(value, cursor - 1);
  }

  if (key === "l") {
    return clampNormalCursor(value, cursor + 1);
  }

  return moveStuffBodyCursorByWordOrLine(value, cursor, key);
}

function moveStuffBodyCursorByWordOrLine(value: string, cursor: number, key: string): number {
  if (key === "w") {
    return nextWordStart(value, cursor);
  }

  if (key === "b") {
    return previousWordStart(value, cursor);
  }

  return key === "j" || key === "k" ? clampNormalCursor(value, verticalCursor(value, cursor, key === "j" ? 1 : -1)) : cursor;
}

function cursorUpdate(command: StuffBodyVimCommand, cursor: number): StuffBodyVimUpdate {
  const nextCursor = clampNormalCursor(command.value, cursor);
  return { ...command, activeCursor: nextCursor, copiedText: null, handled: true, pendingKey: null, selectionEnd: nextCursor, selectionStart: nextCursor };
}

function insertCursorUpdate(command: StuffBodyVimCommand, cursor: number): StuffBodyVimUpdate {
  const nextCursor = clampCursor(command.value, cursor);
  return { ...command, activeCursor: nextCursor, copiedText: null, handled: true, pendingKey: null, selectionEnd: nextCursor, selectionStart: nextCursor };
}

function unchangedUpdate(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  return { ...command, copiedText: null, handled: false };
}

function selectedText(command: StuffBodyVimCommand): string {
  const start = Math.min(command.selectionStart, command.selectionEnd);
  const end = Math.max(command.selectionStart, command.selectionEnd);
  return command.value.slice(start, end);
}

function currentLineText(command: StuffBodyVimCommand): string {
  const start = currentLineStart(command.value, command.activeCursor);
  const end = currentLineEnd(command.value, command.activeCursor);
  return command.value.slice(start, end);
}

function currentLineDeleteRange(command: StuffBodyVimCommand): Pick<StuffBodyVimState, "selectionStart" | "selectionEnd"> {
  const lineStart = currentLineStart(command.value, command.activeCursor);
  const lineEnd = currentLineEnd(command.value, command.activeCursor);

  if (lineEnd < command.value.length) {
    return { selectionEnd: lineEnd + 1, selectionStart: lineStart };
  }

  return { selectionEnd: lineEnd, selectionStart: lineStart > 0 ? lineStart - 1 : lineStart };
}

function visualSelection(anchor: number, cursor: number): Pick<StuffBodyVimState, "activeCursor" | "selectionStart" | "selectionEnd"> {
  return { activeCursor: cursor, selectionEnd: Math.max(anchor, cursor), selectionStart: Math.min(anchor, cursor) };
}

function visualLineSelection(value: string, anchor: number, cursor: number): Pick<StuffBodyVimState, "activeCursor" | "selectionStart" | "selectionEnd"> {
  return { activeCursor: cursor, selectionEnd: currentLineEnd(value, Math.max(anchor, cursor)), selectionStart: currentLineStart(value, Math.min(anchor, cursor)) };
}

function openLineBelow(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  const insertAt = currentLineEnd(command.value, command.activeCursor);
  const value = `${command.value.slice(0, insertAt)}\n${command.value.slice(insertAt)}`;
  return { ...command, activeCursor: insertAt + 1, copiedText: null, handled: true, mode: "insert", selectionEnd: insertAt + 1, selectionStart: insertAt + 1, value };
}

function normalCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  if (command.pendingKey === "g") {
    return command.key === "g" ? cursorUpdate(command, 0) : { ...command, copiedText: null, handled: true, pendingKey: null };
  }

  if (command.pendingKey === "d") {
    return command.key === "d" ? deleteCurrentLine(command) : { ...command, copiedText: null, handled: true, pendingKey: null };
  }

  return normalCommandWithoutPending(command);
}

function normalCommandWithoutPending(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  const nextCursor = moveStuffBodyCursor(command.value, command.activeCursor, command.key);

  if (nextCursor !== command.activeCursor) {
    return cursorUpdate(command, nextCursor);
  }

  return normalEditingCommand(command);
}

function normalEditingCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  if (command.key === "g") {
    return { ...command, copiedText: null, handled: true, pendingKey: "g" };
  }

  if (command.key === "d") {
    return { ...command, copiedText: null, handled: true, pendingKey: "d" };
  }

  if (command.key === "G") {
    return cursorUpdate(command, lastLineStart(command.value));
  }

  return normalModeCommand(command);
}

function normalModeCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  if (command.key === "i") {
    return { ...command, copiedText: null, handled: true, mode: "insert", pendingKey: null };
  }

  if (command.key === "a") {
    return { ...insertCursorUpdate(command, command.activeCursor + 1), mode: "insert" };
  }

  return normalSelectionCommand(command);
}

function normalSelectionCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  if (command.key === "o") {
    return openLineBelow(command);
  }

  if (command.key === "v") {
    return { ...command, copiedText: null, handled: true, mode: "visual", visualAnchor: command.activeCursor };
  }

  return command.key === "V" ? enterVisualLine(command) : yankCurrentLine(command);
}

function enterVisualLine(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  return { ...command, ...visualLineSelection(command.value, command.activeCursor, command.activeCursor), copiedText: null, handled: true, mode: "visual-line" };
}

function yankCurrentLine(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  return command.key === "y" ? { ...command, copiedText: currentLineText(command), handled: true, pendingKey: null } : unchangedUpdate(command);
}

function deleteCurrentLine(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  const range = currentLineDeleteRange(command);
  const value = `${command.value.slice(0, range.selectionStart)}${command.value.slice(range.selectionEnd)}`;
  return { ...cursorUpdate({ ...command, value }, range.selectionStart), value };
}

function visualCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  if (command.key === "Escape") {
    return cursorUpdate({ ...command, mode: "normal" }, command.selectionStart);
  }

  if (command.key === "y") {
    return { ...command, copiedText: selectedText(command), handled: true, mode: "normal", pendingKey: null };
  }

  return visualMoveCommand(command);
}

function visualMoveCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  const cursor = moveStuffBodyCursor(command.value, command.activeCursor, command.key);
  return { ...command, ...visualSelection(command.visualAnchor, cursor), copiedText: null, handled: cursor !== command.activeCursor };
}

function visualLineCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  if (command.key === "Escape") {
    return cursorUpdate({ ...command, mode: "normal" }, command.selectionStart);
  }

  if (command.key === "y") {
    return { ...command, copiedText: selectedText(command), handled: true, mode: "normal", pendingKey: null };
  }

  return visualLineMoveCommand(command);
}

function visualLineMoveCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  const cursor = moveStuffBodyCursor(command.value, command.activeCursor, command.key);
  return { ...command, ...visualLineSelection(command.value, command.visualAnchor, cursor), copiedText: null, handled: cursor !== command.activeCursor };
}

/**
 * Applies one supported Vim key to the stuff body editing state.
 *
 * @example applyStuffBodyVimCommand({ ...initialStuffBodyVimState, key: "i", value: "" })
 */
export function applyStuffBodyVimCommand(command: StuffBodyVimCommand): StuffBodyVimUpdate {
  if (command.mode === "insert") {
    return command.key === "Escape" ? cursorUpdate({ ...command, mode: "normal" }, command.selectionEnd) : unchangedUpdate(command);
  }

  if (command.mode === "visual") {
    return visualCommand(command);
  }

  return command.mode === "visual-line" ? visualLineCommand(command) : normalCommand(command);
}
