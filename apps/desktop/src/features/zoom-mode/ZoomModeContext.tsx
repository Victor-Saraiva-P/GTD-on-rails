import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PropsWithChildren
} from "react";
import { useKeybindContext, hasActiveModalKeybindScope } from "../keybinds/KeybindProvider";
import { resolveZoomDetailZone } from "./zoomModeTransitions";
import type { FocusZoneId } from "../keybinds/types";

export type ZoomModeContextValue = {
  isZoomMode: boolean;
  enterZoomMode: () => void;
  exitZoomMode: () => void;
  toggleZoomMode: () => void;
};

const ZoomModeContext = createContext<ZoomModeContextValue | null>(null);

function isEditorOrInputActive(): boolean {
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement)) return false;
  return (
    active.isContentEditable ||
    active.classList.contains("cm-content") ||
    active.closest(".cm-editor") !== null ||
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  );
}

function useZoomModeEscapeListener(isZoomMode: boolean, exitZoomMode: () => void) {
  useEffect(() => {
    if (!isZoomMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || hasActiveModalKeybindScope() || isEditorOrInputActive()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      exitZoomMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitZoomMode, isZoomMode]);
}

function applyZoomEnterZone(
  activeZone: string,
  savedZoneRef: MutableRefObject<FocusZoneId | null>,
  setActiveZone: (z: FocusZoneId) => void
) {
  const detailZone = resolveZoomDetailZone(activeZone);
  if (detailZone) {
    savedZoneRef.current = activeZone as FocusZoneId;
    setActiveZone(detailZone as FocusZoneId);
  }
}

function restoreZoomExitZone(
  savedZoneRef: MutableRefObject<FocusZoneId | null>,
  setActiveZone: (z: FocusZoneId) => void
) {
  if (savedZoneRef.current) {
    setActiveZone(savedZoneRef.current);
    savedZoneRef.current = null;
  }
}

function useZoomModeCallbacks(
  activeZone: string,
  savedZoneRef: MutableRefObject<FocusZoneId | null>,
  setActiveZone: (z: FocusZoneId) => void,
  setIsZoomMode: (val: boolean | ((prev: boolean) => boolean)) => void
) {
  const enterZoomMode = useCallback(() => {
    applyZoomEnterZone(activeZone, savedZoneRef, setActiveZone);
    setIsZoomMode(true);
  }, [activeZone, setActiveZone, setIsZoomMode]);

  const exitZoomMode = useCallback(() => {
    restoreZoomExitZone(savedZoneRef, setActiveZone);
    setIsZoomMode(false);
  }, [setActiveZone, setIsZoomMode]);

  return { enterZoomMode, exitZoomMode };
}

function useZoomTransitions(
  setIsZoomMode: (val: boolean | ((prev: boolean) => boolean)) => void
) {
  const { activeZone, setActiveZone } = useKeybindContext();
  const savedZoneRef = useRef<FocusZoneId | null>(null);
  const { enterZoomMode, exitZoomMode } = useZoomModeCallbacks(activeZone, savedZoneRef, setActiveZone, setIsZoomMode);

  const toggleZoomMode = useCallback(() => {
    setIsZoomMode((prev) => {
      const next = !prev;
      if (next) applyZoomEnterZone(activeZone, savedZoneRef, setActiveZone);
      else restoreZoomExitZone(savedZoneRef, setActiveZone);
      return next;
    });
  }, [activeZone, setActiveZone, setIsZoomMode]);

  return { enterZoomMode, exitZoomMode, toggleZoomMode };
}

/**
 * Provides Zoom / Focus Mode state across the desktop app.
 *
 * @example <ZoomModeProvider><AppShell /></ZoomModeProvider>
 */
export function ZoomModeProvider({ children }: PropsWithChildren) {
  const [isZoomMode, setIsZoomMode] = useState(false);
  const { enterZoomMode, exitZoomMode, toggleZoomMode } = useZoomTransitions(setIsZoomMode);

  useZoomModeEscapeListener(isZoomMode, exitZoomMode);

  const value = useMemo(
    () => ({ enterZoomMode, exitZoomMode, isZoomMode, toggleZoomMode }),
    [enterZoomMode, exitZoomMode, isZoomMode, toggleZoomMode]
  );

  return <ZoomModeContext.Provider value={value}>{children}</ZoomModeContext.Provider>;
}

/**
 * Accesses Zoom Mode state and toggles.
 *
 * @example const { isZoomMode, toggleZoomMode } = useZoomMode()
 */
export function useZoomMode(): ZoomModeContextValue {
  const context = useContext(ZoomModeContext);
  if (!context) {
    throw new Error("ZoomMode context value is 'null'; expected useZoomMode inside <ZoomModeProvider>.");
  }
  return context;
}
