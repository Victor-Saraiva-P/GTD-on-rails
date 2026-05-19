import { useEffect } from "react";
import { useKeybindContext } from "./KeybindProvider";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "./types";

/**
 * Marks the active keybind screen while a page is mounted.
 *
 * @example useKeybindScreen("inbox")
 */
export function useKeybindScreen(screen: ScreenId) {
  const { setActiveScreen } = useKeybindContext();

  useEffect(() => {
    setActiveScreen(screen);
  }, [screen, setActiveScreen]);
}

/**
 * Reads and updates the currently focused keybind zone.
 *
 * @example const { activeZone, setActiveZone } = useActiveZone()
 */
export function useActiveZone() {
  const { activeZone, setActiveZone } = useKeybindContext();

  return {
    activeZone,
    setActiveZone
  };
}

/**
 * Reads and updates the currently active keybind screen.
 *
 * @example const { activeScreen, setActiveScreen } = useActiveScreen()
 */
export function useActiveScreen() {
  const { activeScreen, setActiveScreen } = useKeybindContext();

  return {
    activeScreen,
    setActiveScreen
  };
}

/**
 * Reads leader-menu state and exposes the close action.
 *
 * @example const { isLeaderMenuOpen } = useLeaderMenu()
 */
export function useLeaderMenu() {
  const { closeLeaderMenu, isLeaderMenuOpen } = useKeybindContext();

  return {
    closeLeaderMenu,
    isLeaderMenuOpen
  };
}

/**
 * Registers keybindings for the current component lifetime.
 *
 * @example useRegisterKeybinds(bindings)
 */
export function useRegisterKeybinds(bindings: KeybindDefinition[]) {
  const { registerBindings } = useKeybindContext();

  useEffect(() => registerBindings(bindings), [bindings, registerBindings]);
}

/**
 * Compares the current focus zone with a candidate zone.
 *
 * @example isZoneActive(activeZone, "inbox-list")
 */
export function isZoneActive(activeZone: FocusZoneId, zone: FocusZoneId) {
  return activeZone === zone;
}
