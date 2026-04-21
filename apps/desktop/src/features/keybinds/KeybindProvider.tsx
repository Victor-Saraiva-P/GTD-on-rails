import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "./types";

type RegisteredKeybind = KeybindDefinition & {
  registrationId: symbol;
};

type KeybindContextValue = {
  activeScreen: ScreenId;
  activeZone: FocusZoneId;
  closeLeaderMenu: () => void;
  isLeaderMenuOpen: boolean;
  getAvailableLeaderBindings: () => KeybindDefinition[];
  registerBindings: (bindings: KeybindDefinition[]) => () => void;
  setActiveScreen: (screen: ScreenId) => void;
  setActiveZone: (zone: FocusZoneId) => void;
};

const KeybindContext = createContext<KeybindContextValue | null>(null);

export function KeybindProvider({ children }: PropsWithChildren) {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("inbox");
  const [activeZone, setActiveZone] = useState<FocusZoneId>("inbox-list");
  const [isLeaderMenuOpen, setIsLeaderMenuOpen] = useState(false);
  const bindingsRef = useRef<RegisteredKeybind[]>([]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement);

      if (isTypingTarget) {
        return;
      }

      if (isLeaderMenuOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsLeaderMenuOpen(false);
          return;
        }

        const matchingLeaderBinding = bindingsRef.current.find((binding) => {
          const screenMatches = !binding.screen || binding.screen === activeScreen;
          const zoneMatches = !binding.zone || binding.zone === activeZone;

          return screenMatches && zoneMatches && binding.leader && binding.key === event.key;
        });

        event.preventDefault();

        if (matchingLeaderBinding) {
          matchingLeaderBinding.handler();
        }

        setIsLeaderMenuOpen(false);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setIsLeaderMenuOpen(true);
        return;
      }

      const matchingBinding = bindingsRef.current.find((binding) => {
        const screenMatches = !binding.screen || binding.screen === activeScreen;
        const zoneMatches = !binding.zone || binding.zone === activeZone;

        return screenMatches && zoneMatches && !binding.leader && binding.key === event.key;
      });

      if (!matchingBinding) {
        return;
      }

      event.preventDefault();
      matchingBinding.handler();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeScreen, activeZone, isLeaderMenuOpen]);

  const registerBindings = useCallback((bindings: KeybindDefinition[]) => {
    const registrationId = Symbol("keybind-registration");
    const registeredBindings = bindings.map((binding) => ({
      ...binding,
      registrationId
    }));

    bindingsRef.current = [...bindingsRef.current, ...registeredBindings];

    return () => {
      bindingsRef.current = bindingsRef.current.filter(
        (binding) => binding.registrationId !== registrationId
      );
    };
  }, []);

  const getAvailableLeaderBindings = useCallback(
    () =>
      bindingsRef.current.filter((binding) => {
        const screenMatches = !binding.screen || binding.screen === activeScreen;
        const zoneMatches = !binding.zone || binding.zone === activeZone;

        return screenMatches && zoneMatches && binding.leader;
      }),
    [activeScreen, activeZone]
  );

  const value = useMemo<KeybindContextValue>(
    () => ({
      activeScreen,
      activeZone,
      closeLeaderMenu: () => setIsLeaderMenuOpen(false),
      isLeaderMenuOpen,
      getAvailableLeaderBindings,
      registerBindings,
      setActiveScreen,
      setActiveZone
    }),
    [activeScreen, activeZone, getAvailableLeaderBindings, isLeaderMenuOpen, registerBindings]
  );

  return <KeybindContext.Provider value={value}>{children}</KeybindContext.Provider>;
}

export function useKeybindContext() {
  const context = useContext(KeybindContext);

  if (!context) {
    throw new Error("Keybind context not available");
  }

  return context;
}
