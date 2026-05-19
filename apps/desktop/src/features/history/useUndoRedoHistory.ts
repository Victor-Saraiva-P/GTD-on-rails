import { useCallback, useRef, useState } from "react";
import { undoRedoMaxStackSize } from "../../config/env";

export type HistoryAction<T> = {
  type: "DELETE" | "RESTORE";
  payload: T;
};

export function useUndoRedoHistory<T>() {
  const [hasUndo, setHasUndo] = useState(false);
  const [hasRedo, setHasRedo] = useState(false);
  
  const undoStackRef = useRef<HistoryAction<T>[]>([]);
  const redoStackRef = useRef<HistoryAction<T>[]>([]);

  const updateState = () => {
    setHasUndo(undoStackRef.current.length > 0);
    setHasRedo(redoStackRef.current.length > 0);
  };

  const pushUndo = useCallback((action: HistoryAction<T>) => {
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > undoRedoMaxStackSize) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    updateState();
  }, []);

  const popUndo = useCallback((): HistoryAction<T> | null => {
    const actionToReturn = undoStackRef.current.pop() ?? null;
    
    if (actionToReturn) {
      const redoAction: HistoryAction<T> = {
        type: actionToReturn.type === "DELETE" ? "RESTORE" : "DELETE",
        payload: actionToReturn.payload
      };
      redoStackRef.current.push(redoAction);
    }
    
    updateState();
    return actionToReturn;
  }, []);

  const popRedo = useCallback((): HistoryAction<T> | null => {
    const actionToReturn = redoStackRef.current.pop() ?? null;

    if (actionToReturn) {
      const undoAction: HistoryAction<T> = {
        type: actionToReturn.type === "DELETE" ? "RESTORE" : "DELETE",
        payload: actionToReturn.payload
      };
      undoStackRef.current.push(undoAction);
    }

    updateState();
    return actionToReturn;
  }, []);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    updateState();
  }, []);

  return {
    pushUndo,
    popUndo,
    popRedo,
    clearHistory,
    hasUndo,
    hasRedo
  };
}
