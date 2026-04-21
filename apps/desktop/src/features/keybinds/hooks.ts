import { useEffect } from "react";
import { useKeybindContext } from "./KeybindProvider";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "./types";

export function useKeybindScreen(screen: ScreenId) {
  const { setActiveScreen } = useKeybindContext();

  useEffect(() => {
    setActiveScreen(screen);
  }, [screen, setActiveScreen]);
}

export function useActiveZone() {
  const { activeZone, setActiveZone } = useKeybindContext();

  return {
    activeZone,
    setActiveZone
  };
}

export function useLeaderMenu() {
  const { closeLeaderMenu, isLeaderMenuOpen } = useKeybindContext();

  return {
    closeLeaderMenu,
    isLeaderMenuOpen
  };
}

export function useRegisterKeybinds(bindings: KeybindDefinition[]) {
  const { registerBindings } = useKeybindContext();

  useEffect(() => registerBindings(bindings), [bindings, registerBindings]);
}

export function isZoneActive(activeZone: FocusZoneId, zone: FocusZoneId) {
  return activeZone === zone;
}
