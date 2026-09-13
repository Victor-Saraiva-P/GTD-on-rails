import type { FocusZoneId, ScreenId } from "../keybinds/types";

export type JumpEntry = {
  screen: ScreenId;
  zone?: FocusZoneId;
  projectId?: string | null;
  projectTitle?: string | null;
  selectedItemId?: string | null;
};

export type JumpListState = {
  entries: JumpEntry[];
  currentIndex: number;
};

/**
 * Initializes a new jump list state with an optional initial location.
 *
 * @example const state = createJumpList({ screen: "inbox" })
 */
export function createJumpList(initialEntry?: JumpEntry): JumpListState {
  return {
    entries: initialEntry ? [initialEntry] : [],
    currentIndex: initialEntry ? 0 : -1
  };
}

/**
 * Compares two jump entries to determine if they represent the same user destination.
 *
 * @example areJumpEntriesEqual(entryA, entryB)
 */
export function areJumpEntriesEqual(
  a: JumpEntry | null | undefined,
  b: JumpEntry | null | undefined
): boolean {
  if (!a || !b) return false;
  return (
    a.screen === b.screen &&
    (a.projectId ?? null) === (b.projectId ?? null) &&
    (a.selectedItemId ?? null) === (b.selectedItemId ?? null)
  );
}

/**
 * Records a navigation jump from the source location to the target location.
 *
 * @example pushJump(state, currentLocation, targetLocation)
 */
export function pushJump(
  state: JumpListState,
  fromEntry: JumpEntry,
  toEntry: JumpEntry
): JumpListState {
  if (areJumpEntriesEqual(fromEntry, toEntry)) {
    return state;
  }

  const history = state.entries.slice(0, state.currentIndex + 1);
  if (history.length === 0) {
    return {
      entries: [fromEntry, toEntry],
      currentIndex: 1
    };
  }

  const lastEntry = history[history.length - 1];
  const newEntries = areJumpEntriesEqual(lastEntry, fromEntry)
    ? [...history, toEntry]
    : [...history, fromEntry, toEntry];

  return {
    entries: newEntries,
    currentIndex: newEntries.length - 1
  };
}

/**
 * Moves backward in the jump list to an older cursor position.
 *
 * @example const result = jumpBack(state)
 */
export function jumpBack(
  state: JumpListState
): { state: JumpListState; entry: JumpEntry } | null {
  if (state.currentIndex <= 0 || state.entries.length === 0) {
    return null;
  }
  const nextIndex = state.currentIndex - 1;
  return {
    state: { ...state, currentIndex: nextIndex },
    entry: state.entries[nextIndex]
  };
}

/**
 * Moves forward in the jump list to a newer cursor position.
 *
 * @example const result = jumpForward(state)
 */
export function jumpForward(
  state: JumpListState
): { state: JumpListState; entry: JumpEntry } | null {
  if (state.currentIndex >= state.entries.length - 1 || state.entries.length === 0) {
    return null;
  }
  const nextIndex = state.currentIndex + 1;
  return {
    state: { ...state, currentIndex: nextIndex },
    entry: state.entries[nextIndex]
  };
}
