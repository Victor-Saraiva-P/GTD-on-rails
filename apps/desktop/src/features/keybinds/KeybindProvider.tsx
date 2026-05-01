import {
  createContext,
  type MutableRefObject,
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

type ScreenState = {
  activeScreen: ScreenId;
  activeZone: FocusZoneId;
  setActiveScreen: (screen: ScreenId) => void;
  setActiveZone: (zone: FocusZoneId) => void;
};

type LeaderMenuState = {
  closeLeaderMenu: () => void;
  isLeaderMenuOpen: boolean;
  leaderPath: string[];
  openLeaderMenu: () => void;
  setLeaderPath: (path: string[]) => void;
};

type KeydownConfig = ScreenState &
  LeaderMenuState & {
    bindingsRef: MutableRefObject<RegisteredKeybind[]>;
  };

function isModifierKey(key: string): boolean {
  return key === "Shift" || key === "Control" || key === "Alt" || key === "Meta";
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

function bindingMatchesZone(
  binding: KeybindDefinition,
  activeScreen: ScreenId,
  activeZone: FocusZoneId
): boolean {
  const screenMatches = !binding.screen || binding.screen === activeScreen;
  const zoneMatches = !binding.zone || binding.zone === activeZone;

  return screenMatches && zoneMatches;
}

function leaderSequence(binding: KeybindDefinition): string[] {
  return binding.sequence ?? [binding.key];
}

function sequenceStartsWith(sequence: string[], path: string[]): boolean {
  return path.every((segment, index) => sequence[index] === segment);
}

function findExactLeaderBinding(bindings: KeybindDefinition[], path: string[]) {
  return bindings.find((binding) => {
    const sequence = leaderSequence(binding);

    return sequence.length === path.length && sequenceStartsWith(sequence, path);
  });
}

function hasLeaderContinuation(bindings: KeybindDefinition[], path: string[]): boolean {
  return bindings.some((binding) => {
    const sequence = leaderSequence(binding);

    return sequence.length > path.length && sequenceStartsWith(sequence, path);
  });
}

function matchingBindings(config: KeydownConfig): RegisteredKeybind[] {
  return config.bindingsRef.current.filter((binding) =>
    bindingMatchesZone(binding, config.activeScreen, config.activeZone)
  );
}

function availableLeaderBindings(config: KeydownConfig): RegisteredKeybind[] {
  return matchingBindings(config).filter((binding) => binding.leader);
}

function nextLeaderBinding(binding: KeybindDefinition, leaderPath: string[]) {
  const sequence = leaderSequence(binding);

  if (!sequenceStartsWith(sequence, leaderPath) || sequence.length <= leaderPath.length) {
    return null;
  }

  return { ...binding, key: sequence[leaderPath.length] };
}

function collectLeaderBindings(bindings: KeybindDefinition[], leaderPath: string[]) {
  const nextBindingsByKey = new Map<string, KeybindDefinition>();

  bindings.forEach((binding) => {
    const nextBinding = nextLeaderBinding(binding, leaderPath);

    if (nextBinding && !nextBindingsByKey.has(nextBinding.key)) {
      nextBindingsByKey.set(nextBinding.key, nextBinding);
    }
  });

  return Array.from(nextBindingsByKey.values());
}

function findDirectBinding(config: KeydownConfig, key: string): RegisteredKeybind | undefined {
  return matchingBindings(config).find((binding) => !binding.leader && binding.key === key);
}

function handleLeaderKey(event: KeyboardEvent, config: KeydownConfig) {
  if (event.key === "Escape") {
    event.preventDefault();
    config.closeLeaderMenu();
    return;
  }

  if (isModifierKey(event.key)) {
    return;
  }

  const leaderBindings = availableLeaderBindings(config);
  const nextLeaderPath = [...config.leaderPath, event.key];

  event.preventDefault();
  handleLeaderMatch(leaderBindings, nextLeaderPath, config);
}

function handleLeaderMatch(
  leaderBindings: KeybindDefinition[],
  nextLeaderPath: string[],
  config: LeaderMenuState
) {
  if (hasLeaderContinuation(leaderBindings, nextLeaderPath)) {
    config.setLeaderPath(nextLeaderPath);
    return;
  }

  findExactLeaderBinding(leaderBindings, nextLeaderPath)?.runKeybind();
  config.closeLeaderMenu();
}

function handleGlobalKeyDown(event: KeyboardEvent, config: KeydownConfig) {
  if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (config.isLeaderMenuOpen) {
    handleLeaderKey(event, config);
    return;
  }

  if (event.key === " ") {
    event.preventDefault();
    config.openLeaderMenu();
    return;
  }

  handleDirectKey(event, config);
}

function handleDirectKey(event: KeyboardEvent, config: KeydownConfig) {
  const matchingBinding = findDirectBinding(config, event.key);

  if (!matchingBinding) {
    return;
  }

  event.preventDefault();
  matchingBinding.runKeybind();
}

function useScreenState(): ScreenState {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("inbox");
  const [activeZone, setActiveZone] = useState<FocusZoneId>("inbox-list");

  return { activeScreen, activeZone, setActiveScreen, setActiveZone };
}

function useLeaderMenuState(): LeaderMenuState {
  const [isLeaderMenuOpen, setIsLeaderMenuOpen] = useState(false);
  const [leaderPath, setLeaderPath] = useState<string[]>([]);

  const closeLeaderMenu = useCallback(() => {
    setIsLeaderMenuOpen(false);
    setLeaderPath([]);
  }, []);

  const openLeaderMenu = useCallback(() => {
    setIsLeaderMenuOpen(true);
    setLeaderPath([]);
  }, []);

  return { closeLeaderMenu, isLeaderMenuOpen, leaderPath, openLeaderMenu, setLeaderPath };
}

function useRegisterBindings(bindingsRef: MutableRefObject<RegisteredKeybind[]>) {
  return useCallback((bindings: KeybindDefinition[]) => {
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
}

function useAvailableLeaderBindings(config: KeydownConfig) {
  return useCallback(() => {
    return collectLeaderBindings(availableLeaderBindings(config), config.leaderPath);
  }, [config]);
}

function useKeydownListener(config: KeydownConfig) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleGlobalKeyDown(event, config);

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [config]);
}

function useKeybindConfig(
  screenState: ScreenState,
  leaderMenuState: LeaderMenuState,
  bindingsRef: MutableRefObject<RegisteredKeybind[]>
): KeydownConfig {
  return useMemo(() => ({ ...screenState, ...leaderMenuState, bindingsRef }), [
    bindingsRef,
    leaderMenuState,
    screenState
  ]);
}

function useKeybindContextValue(
  config: KeydownConfig,
  registerBindings: KeybindContextValue["registerBindings"],
  getAvailableLeaderBindings: KeybindContextValue["getAvailableLeaderBindings"]
): KeybindContextValue {
  return useMemo(
    () => ({
      activeScreen: config.activeScreen,
      activeZone: config.activeZone,
      closeLeaderMenu: config.closeLeaderMenu,
      leaderPath: config.leaderPath,
      isLeaderMenuOpen: config.isLeaderMenuOpen,
      getAvailableLeaderBindings,
      registerBindings,
      setActiveScreen: config.setActiveScreen,
      setActiveZone: config.setActiveZone
    }),
    [config, getAvailableLeaderBindings, registerBindings]
  );
}

function useKeybindController(): KeybindContextValue {
  const screenState = useScreenState();
  const leaderMenuState = useLeaderMenuState();
  const bindingsRef = useRef<RegisteredKeybind[]>([]);
  const config = useKeybindConfig(screenState, leaderMenuState, bindingsRef);
  const registerBindings = useRegisterBindings(bindingsRef);
  const getAvailableLeaderBindings = useAvailableLeaderBindings(config);

  useKeydownListener(config);
  return useKeybindContextValue(config, registerBindings, getAvailableLeaderBindings);
}

/**
 * Provides global keybind state and dispatch for descendant screens.
 *
 * @example <KeybindProvider><AppShell /></KeybindProvider>
 */
export function KeybindProvider({ children }: PropsWithChildren) {
  const value = useKeybindController();

  return <KeybindContext.Provider value={value}>{children}</KeybindContext.Provider>;
}

/**
 * Reads the keybind context created by KeybindProvider.
 *
 * @example const { registerBindings } = useKeybindContext()
 */
export function useKeybindContext() {
  const context = useContext(KeybindContext);

  if (!context) {
    throw new Error("Keybind context value is 'null'; expected useKeybindContext inside <KeybindProvider>.");
  }

  return context;
}
