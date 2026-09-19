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
import { isVimEditorAwaitingArgument } from "./isVimAwaitingArgument.ts";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "./types";

type RegisteredKeybind = KeybindDefinition & {
  registrationId: symbol;
};

type WhichKeyState = {
  closeWhichKey: () => void;
  isWhichKeyOpen: boolean;
  openWhichKey: () => void;
};

type KeybindContextValue = {
  activeScreen: ScreenId;
  activeZone: FocusZoneId;
  closeLeaderMenu: () => void;
  leaderPath: string[];
  isLeaderMenuOpen: boolean;
  getAvailableLeaderBindings: () => KeybindDefinition[];
  getActiveZoneBindings: () => KeybindDefinition[];
  isWhichKeyOpen: boolean;
  openWhichKey: () => void;
  closeWhichKey: () => void;
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

type DirectSequenceState = {
  directPathRef: MutableRefObject<string[]>;
  setDirectPath: (path: string[]) => void;
};

type KeydownConfig = ScreenState &
  DirectSequenceState &
  LeaderMenuState &
  WhichKeyState & {
    bindingsRef: MutableRefObject<RegisteredKeybind[]>;
  };

function isModifierKey(key: string): boolean {
  return key === "Shift" || key === "Control" || key === "Alt" || key === "Meta";
}

function isVimKeybindTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.closest('[data-vim-mode="normal"], [data-vim-mode="visual"]') !== null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (isVimKeybindTarget(target)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function hasActiveModalKeybindScope(): boolean {
  return document.querySelector('dialog, [aria-modal="true"], .gtd-hint-overlay') !== null;
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

function findDirectBinding(config: KeydownConfig, event: KeyboardEvent): RegisteredKeybind | undefined {
  return matchingBindings(config).find(
    (binding) => !binding.leader && leaderSequence(binding).length === 1 && binding.key === event.key && Boolean(binding.ctrl) === event.ctrlKey
  );
}

function findDirectSequenceBinding(bindings: RegisteredKeybind[], path: string[]): RegisteredKeybind | undefined {
  return bindings.find((binding) => {
    const sequence = leaderSequence(binding);
    return !binding.leader && !binding.ctrl && sequence.length === path.length && sequenceStartsWith(sequence, path);
  });
}

function hasDirectSequenceContinuation(bindings: RegisteredKeybind[], path: string[]): boolean {
  return bindings.some((binding) => {
    if (binding.leader || binding.ctrl) return false;
    const sequence = leaderSequence(binding);
    return sequence.length > path.length && sequenceStartsWith(sequence, path);
  });
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
  config: LeaderMenuState & WhichKeyState
) {
  if (hasLeaderContinuation(leaderBindings, nextLeaderPath)) {
    config.setLeaderPath(nextLeaderPath);
    return;
  }

  if (nextLeaderPath.length === 1 && nextLeaderPath[0] === "k") {
    config.openWhichKey();
    config.closeLeaderMenu();
    return;
  }

  findExactLeaderBinding(leaderBindings, nextLeaderPath)?.runKeybind();
  config.closeLeaderMenu();
}

function handleGlobalKeyDown(event: KeyboardEvent, config: KeydownConfig) {
  if (hasActiveModalKeybindScope()) {
    if (config.isLeaderMenuOpen) config.closeLeaderMenu();
    return;
  }

  if (isTypingTarget(event.target) || event.metaKey || event.altKey) {
    return;
  }

  if (config.isLeaderMenuOpen) {
    event.stopPropagation();
    handleLeaderKey(event, config);
    return;
  }

  if (event.key === " " && !event.ctrlKey) {
    if (isVimKeybindTarget(event.target) && isVimEditorAwaitingArgument()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    config.openLeaderMenu();
    return;
  }

  if (isVimKeybindTarget(event.target)) {
    // Redo (Ctrl-R) is a Vim command, but we might want to handle it globally for the list.
    // If the target is a Vim editor, we let it handle Ctrl-R unless we are in the list.
    return;
  }

  handleDirectKey(event, config);
}

function executeSequenceBinding(event: KeyboardEvent, config: KeydownConfig, binding: RegisteredKeybind): boolean {
  event.preventDefault();
  event.stopPropagation();
  config.setDirectPath([]);
  binding.runKeybind();
  return true;
}

function handleDirectSequence(event: KeyboardEvent, config: KeydownConfig): boolean {
  const directBindings = matchingBindings(config).filter((binding) => !binding.leader);
  const nextDirectPath = [...config.directPathRef.current, event.key];

  if (hasDirectSequenceContinuation(directBindings, nextDirectPath)) {
    event.preventDefault();
    event.stopPropagation();
    config.setDirectPath(nextDirectPath);
    return true;
  }

  const sequenceBinding = findDirectSequenceBinding(directBindings, nextDirectPath);
  if (!sequenceBinding) {
    config.setDirectPath([]);
    return false;
  }

  return executeSequenceBinding(event, config, sequenceBinding);
}

function handleDirectKey(event: KeyboardEvent, config: KeydownConfig) {
  if (event.ctrlKey) config.setDirectPath([]);
  if (!event.ctrlKey && handleDirectSequence(event, config)) return;
  const matchingBinding = findDirectBinding(config, event);
  if (!matchingBinding) return;
  event.preventDefault();
  event.stopPropagation();
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

function useDirectSequenceState(): DirectSequenceState {
  const directPathRef = useRef<string[]>([]);
  const setDirectPath = useCallback((path: string[]) => {
    directPathRef.current = path;
  }, []);

  return { directPathRef, setDirectPath };
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

    window.addEventListener("keydown", onKeyDown, { capture: true });

    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [config]);
}

function useWhichKeyState(): WhichKeyState {
  const [isWhichKeyOpen, setIsWhichKeyOpen] = useState(false);
  const openWhichKey = useCallback(() => setIsWhichKeyOpen(true), []);
  const closeWhichKey = useCallback(() => setIsWhichKeyOpen(false), []);
  return { closeWhichKey, isWhichKeyOpen, openWhichKey };
}

function useActiveZoneBindings(config: KeydownConfig) {
  return useCallback(() => {
    return matchingBindings(config);
  }, [config]);
}

function useKeybindConfig(
  screenState: ScreenState,
  leaderMenuState: LeaderMenuState,
  whichKeyState: WhichKeyState,
  directSequenceState: DirectSequenceState,
  bindingsRef: MutableRefObject<RegisteredKeybind[]>
): KeydownConfig {
  return useMemo(() => ({ ...screenState, ...leaderMenuState, ...whichKeyState, ...directSequenceState, bindingsRef }), [
    bindingsRef,
    directSequenceState,
    leaderMenuState,
    screenState,
    whichKeyState
  ]);
}

function useKeybindContextValue(
  config: KeydownConfig,
  registerBindings: KeybindContextValue["registerBindings"],
  getAvailableLeaderBindings: KeybindContextValue["getAvailableLeaderBindings"],
  getActiveZoneBindings: KeybindContextValue["getActiveZoneBindings"]
): KeybindContextValue {
  return useMemo(
    () => ({
      activeScreen: config.activeScreen,
      activeZone: config.activeZone,
      closeLeaderMenu: config.closeLeaderMenu,
      leaderPath: config.leaderPath,
      isLeaderMenuOpen: config.isLeaderMenuOpen,
      getAvailableLeaderBindings,
      getActiveZoneBindings,
      isWhichKeyOpen: config.isWhichKeyOpen,
      openWhichKey: config.openWhichKey,
      closeWhichKey: config.closeWhichKey,
      registerBindings,
      setActiveScreen: config.setActiveScreen,
      setActiveZone: config.setActiveZone
    }),
    [config, getActiveZoneBindings, getAvailableLeaderBindings, registerBindings]
  );
}

function useKeybindController(): KeybindContextValue {
  const screenState = useScreenState();
  const leaderMenuState = useLeaderMenuState();
  const whichKeyState = useWhichKeyState();
  const directSequenceState = useDirectSequenceState();
  const bindingsRef = useRef<RegisteredKeybind[]>([]);
  const config = useKeybindConfig(screenState, leaderMenuState, whichKeyState, directSequenceState, bindingsRef);
  const registerBindings = useRegisterBindings(bindingsRef);
  const getAvailableLeaderBindings = useAvailableLeaderBindings(config);
  const getActiveZoneBindings = useActiveZoneBindings(config);

  useKeydownListener(config);
  return useKeybindContextValue(config, registerBindings, getAvailableLeaderBindings, getActiveZoneBindings);
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
