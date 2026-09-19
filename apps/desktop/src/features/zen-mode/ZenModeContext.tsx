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
import { resolveZenDetailZone } from "./zenModeTransitions";
import type { FocusZoneId } from "../keybinds/types";

export type ZenModeContextValue = {
  isZenMode: boolean;
  enterZenMode: () => void;
  exitZenMode: () => void;
  toggleZenMode: () => void;
};

const ZenModeContext = createContext<ZenModeContextValue | null>(null);

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

function useZenModeEscapeListener(isZenMode: boolean, exitZenMode: () => void) {
  useEffect(() => {
    if (!isZenMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || hasActiveModalKeybindScope() || isEditorOrInputActive()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      exitZenMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitZenMode, isZenMode]);
}

function applyZenEnterZone(
  activeZone: string,
  savedZoneRef: MutableRefObject<FocusZoneId | null>,
  setActiveZone: (z: FocusZoneId) => void
) {
  const detailZone = resolveZenDetailZone(activeZone);
  if (detailZone) {
    savedZoneRef.current = activeZone as FocusZoneId;
    setActiveZone(detailZone as FocusZoneId);
  }
}

function restoreZenExitZone(
  savedZoneRef: MutableRefObject<FocusZoneId | null>,
  setActiveZone: (z: FocusZoneId) => void
) {
  if (savedZoneRef.current) {
    setActiveZone(savedZoneRef.current);
    savedZoneRef.current = null;
  }
}

function useZenModeCallbacks(
  activeZone: string,
  savedZoneRef: MutableRefObject<FocusZoneId | null>,
  setActiveZone: (z: FocusZoneId) => void,
  setIsZenMode: (val: boolean | ((prev: boolean) => boolean)) => void
) {
  const enterZenMode = useCallback(() => {
    applyZenEnterZone(activeZone, savedZoneRef, setActiveZone);
    setIsZenMode(true);
  }, [activeZone, setActiveZone, setIsZenMode]);

  const exitZenMode = useCallback(() => {
    restoreZenExitZone(savedZoneRef, setActiveZone);
    setIsZenMode(false);
  }, [setActiveZone, setIsZenMode]);

  return { enterZenMode, exitZenMode };
}

function useZenTransitions(
  setIsZenMode: (val: boolean | ((prev: boolean) => boolean)) => void
) {
  const { activeZone, setActiveZone } = useKeybindContext();
  const savedZoneRef = useRef<FocusZoneId | null>(null);
  const { enterZenMode, exitZenMode } = useZenModeCallbacks(activeZone, savedZoneRef, setActiveZone, setIsZenMode);

  const toggleZenMode = useCallback(() => {
    setIsZenMode((prev) => {
      const next = !prev;
      if (next) applyZenEnterZone(activeZone, savedZoneRef, setActiveZone);
      else restoreZenExitZone(savedZoneRef, setActiveZone);
      return next;
    });
  }, [activeZone, setActiveZone, setIsZenMode]);

  return { enterZenMode, exitZenMode, toggleZenMode };
}

/**
 * Provides Zen / Focus Mode state across the desktop app.
 *
 * @example <ZenModeProvider><AppShell /></ZenModeProvider>
 */
export function ZenModeProvider({ children }: PropsWithChildren) {
  const [isZenMode, setIsZenMode] = useState(false);
  const { enterZenMode, exitZenMode, toggleZenMode } = useZenTransitions(setIsZenMode);

  useZenModeEscapeListener(isZenMode, exitZenMode);

  const value = useMemo(
    () => ({ enterZenMode, exitZenMode, isZenMode, toggleZenMode }),
    [enterZenMode, exitZenMode, isZenMode, toggleZenMode]
  );

  return <ZenModeContext.Provider value={value}>{children}</ZenModeContext.Provider>;
}

/**
 * Accesses Zen Mode state and toggles.
 *
 * @example const { isZenMode, toggleZenMode } = useZenMode()
 */
export function useZenMode(): ZenModeContextValue {
  const context = useContext(ZenModeContext);
  if (!context) {
    throw new Error("ZenMode context value is 'null'; expected useZenMode inside <ZenModeProvider>.");
  }
  return context;
}
