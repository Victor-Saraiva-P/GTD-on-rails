import { useCallback, useRef } from "react";
import { undoRedoMaxStackSize } from "../../config/env.ts";
import type { CalendarWorkspaceItem } from "./types.ts";

export type CalendarHistoryActionType = "DELETE" | "DONE" | "ONGOING" | "RESTORE_STATUS" | "RECOVER_DELETED";
export type CalendarHistoryAction = Readonly<{
  type: CalendarHistoryActionType;
  payload: CalendarWorkspaceItem;
}>;

/**
 * Keeps Calendar view operations in one ordered undo/redo history regardless of source kind.
 *
 * @example const history = useCalendarActionHistory()
 */
export function useCalendarActionHistory() {
  const undoRef = useRef<CalendarHistoryAction[]>([]);
  const redoRef = useRef<CalendarHistoryAction[]>([]);
  const pushUndo = useCallback((action: CalendarHistoryAction) => {
    undoRef.current.push(action);
    if (undoRef.current.length > undoRedoMaxStackSize) undoRef.current.shift();
    redoRef.current = [];
  }, []);
  const popUndo = useCallback(() => moveAction(undoRef.current, redoRef.current), []);
  const popRedo = useCallback(() => moveAction(redoRef.current, undoRef.current), []);
  return { pushUndo, popUndo, popRedo };
}

function moveAction(source: CalendarHistoryAction[], target: CalendarHistoryAction[]): CalendarHistoryAction | null {
  const action = source.pop() ?? null;
  if (action) target.push(action);
  return action;
}
