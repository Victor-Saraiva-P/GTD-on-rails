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
  leaderPath: string[];
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
  const [leaderPath, setLeaderPath] = useState<string[]>([]);
  const bindingsRef = useRef<RegisteredKeybind[]>([]);

  useEffect(() => {
    function isModifierKey(key: string) {
      return key === "Shift" || key === "Control" || key === "Alt" || key === "Meta";
    }

    function getLeaderSequence(binding: KeybindDefinition) {
      return binding.sequence ?? [binding.key];
    }

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
          setLeaderPath([]);
          return;
        }

        if (isModifierKey(event.key)) {
          return;
        }

        const leaderBindings = bindingsRef.current.filter((binding) => {
          const screenMatches = !binding.screen || binding.screen === activeScreen;
          const zoneMatches = !binding.zone || binding.zone === activeZone;

          return screenMatches && zoneMatches && binding.leader;
        });
        const nextLeaderPath = [...leaderPath, event.key];
        const exactMatch = leaderBindings.find((binding) => {
          const sequence = getLeaderSequence(binding);

          return (
            sequence.length === nextLeaderPath.length &&
            sequence.every((segment, index) => segment === nextLeaderPath[index])
          );
        });
        const hasContinuation = leaderBindings.some((binding) => {
          const sequence = getLeaderSequence(binding);

          if (sequence.length <= nextLeaderPath.length) {
            return false;
          }

          return nextLeaderPath.every((segment, index) => sequence[index] === segment);
        });

        event.preventDefault();

        if (hasContinuation) {
          setLeaderPath(nextLeaderPath);
          return;
        }

        if (exactMatch) {
          exactMatch.handler();
        }

        setIsLeaderMenuOpen(false);
        setLeaderPath([]);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setIsLeaderMenuOpen(true);
        setLeaderPath([]);
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
  }, [activeScreen, activeZone, isLeaderMenuOpen, leaderPath]);

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

  const getAvailableLeaderBindings = useCallback(() => {
    const availableBindings = bindingsRef.current.filter((binding) => {
        const screenMatches = !binding.screen || binding.screen === activeScreen;
        const zoneMatches = !binding.zone || binding.zone === activeZone;

        return screenMatches && zoneMatches && binding.leader;
      });
    const nextBindingsByKey = new Map<string, KeybindDefinition>();

    availableBindings.forEach((binding) => {
      const sequence = binding.sequence ?? [binding.key];

      if (!leaderPath.every((segment, index) => sequence[index] === segment)) {
        return;
      }

      if (sequence.length <= leaderPath.length) {
        return;
      }

      const nextKey = sequence[leaderPath.length];

      if (nextBindingsByKey.has(nextKey)) {
        return;
      }

      nextBindingsByKey.set(nextKey, {
        ...binding,
        key: nextKey
      });
    });

    return Array.from(nextBindingsByKey.values());
  }, [activeScreen, activeZone, leaderPath]);

  const value = useMemo<KeybindContextValue>(
    () => ({
      activeScreen,
      activeZone,
      closeLeaderMenu: () => {
        setIsLeaderMenuOpen(false);
        setLeaderPath([]);
      },
      leaderPath,
      isLeaderMenuOpen,
      getAvailableLeaderBindings,
      registerBindings,
      setActiveScreen,
      setActiveZone
    }),
    [
      activeScreen,
      activeZone,
      getAvailableLeaderBindings,
      isLeaderMenuOpen,
      leaderPath,
      registerBindings
    ]
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
