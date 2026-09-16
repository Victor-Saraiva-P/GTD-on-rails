import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterKeybinds } from "../keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../keybinds/types";
import { computeTitleMatches, resolveNextMatchIndex } from "./titleSearchMatcher";
import type { SearchableItem, TitleSearchState, UseListTitleSearchOptions } from "./types";

function buildSearchKeybind(
  id: string,
  key: string,
  desc: string,
  run: () => void,
  screen?: ScreenId,
  zone?: FocusZoneId
): KeybindDefinition {
  return { description: desc, id, key, runKeybind: run, screen, zone };
}

function normalizeZones(zone?: FocusZoneId | FocusZoneId[]): (FocusZoneId | undefined)[] {
  if (!zone) return [undefined];
  return Array.isArray(zone) ? zone : [zone];
}

type SearchKeybindActions = {
  open: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
};

function appendZoneBindings(
  bindings: KeybindDefinition[],
  z: FocusZoneId | undefined,
  isOpen: boolean,
  hasQuery: boolean,
  actions: SearchKeybindActions,
  screen?: ScreenId
): void {
  const suffix = z ? `-${z}` : "";
  bindings.push(buildSearchKeybind(`list-search.open${suffix}`, "/", "Search titles", actions.open, screen, z));
  if (!isOpen || !hasQuery) return;
  bindings.push(buildSearchKeybind(`list-search.next${suffix}`, "n", "Next match", actions.next, screen, z));
  bindings.push(buildSearchKeybind(`list-search.prev${suffix}`, "N", "Previous match", actions.prev, screen, z));
  bindings.push(buildSearchKeybind(`list-search.exit${suffix}`, "Escape", "Exit search", actions.close, screen, z));
}

function buildSearchBindings(
  isOpen: boolean,
  hasQuery: boolean,
  actions: SearchKeybindActions,
  screen?: ScreenId,
  zone?: FocusZoneId | FocusZoneId[]
): KeybindDefinition[] {
  const zones = normalizeZones(zone);
  const bindings: KeybindDefinition[] = [];
  for (const z of zones) {
    appendZoneBindings(bindings, z, isOpen, hasQuery, actions, screen);
  }
  return bindings;
}

function useMatchSelectionSync(
  matches: ReturnType<typeof computeTitleMatches>,
  selectedId: string | null,
  activeMatchIndex: number,
  setActiveMatchIndex: (idx: number) => void
) {
  useEffect(() => {
    if (!selectedId || matches.length === 0) return;
    const found = matches.findIndex((m) => m.id === selectedId);
    if (found !== -1 && found !== activeMatchIndex) {
      setActiveMatchIndex(found);
    }
  }, [selectedId, matches, activeMatchIndex, setActiveMatchIndex]);
}

function resolveInitialMatchIndex(matches: readonly SearchableItem[], selectedId: string | null): number {
  if (matches.length === 0) return -1;
  const foundIdx = matches.findIndex((m) => m.id === selectedId);
  return foundIdx !== -1 ? foundIdx : 0;
}

function useSearchQueryState(
  items: readonly SearchableItem[],
  selectedId: string | null,
  setSelectedId: (id: string | null) => void
) {
  const [query, setQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const matches = useMemo(() => computeTitleMatches(items, query), [items, query]);

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    const nextMatches = computeTitleMatches(items, newQuery);
    const targetIdx = resolveInitialMatchIndex(nextMatches, selectedId);
    setActiveMatchIndex(targetIdx);
    if (targetIdx !== -1) setSelectedId(nextMatches[targetIdx].id);
  }, [items, selectedId, setSelectedId]);

  const clear = useCallback(() => {
    setQuery("");
    setActiveMatchIndex(-1);
  }, []);

  useMatchSelectionSync(matches, selectedId, activeMatchIndex, setActiveMatchIndex);
  return { activeMatch: matches[activeMatchIndex] ?? null, activeMatchIndex, clear, matches, query, setActiveMatchIndex, setQuery: handleQueryChange };
}

function useSearchVisibilityState(disabled: boolean, onResetQuery: () => void) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const openSearch = useCallback(() => {
    if (disabled) return;
    setIsSearchOpen(true);
    setIsSearchFocused(true);
  }, [disabled]);

  const closeSearch = useCallback(() => {
    onResetQuery();
    setIsSearchOpen(false);
    setIsSearchFocused(false);
  }, [onResetQuery]);

  const confirmSearch = useCallback(() => setIsSearchFocused(false), []);

  return { closeSearch, confirmSearch, isSearchFocused, isSearchOpen, openSearch };
}

function useSearchNavigation(
  matches: ReturnType<typeof computeTitleMatches>,
  activeMatchIndex: number,
  setActiveMatchIndex: (idx: number) => void,
  setSelectedId: (id: string | null) => void
) {
  const stepMatch = useCallback((step: 1 | -1) => {
    if (matches.length === 0) return;
    const nextIdx = resolveNextMatchIndex(activeMatchIndex, matches.length, step);
    setActiveMatchIndex(nextIdx);
    setSelectedId(matches[nextIdx].id);
  }, [activeMatchIndex, matches, setActiveMatchIndex, setSelectedId]);

  return {
    nextMatch: useCallback(() => stepMatch(1), [stepMatch]),
    previousMatch: useCallback(() => stepMatch(-1), [stepMatch])
  };
}

function useSearchKeybinds(
  disabled: boolean,
  isOpen: boolean,
  query: string,
  actions: SearchKeybindActions,
  screen?: ScreenId,
  zone?: FocusZoneId | FocusZoneId[]
) {
  const bindings = useMemo(() => {
    if (disabled) return [];
    return buildSearchBindings(isOpen, query.trim().length > 0, actions, screen, zone);
  }, [disabled, isOpen, query, actions, screen, zone]);

  useRegisterKeybinds(bindings);
}

function assembleSearchState(
  queryState: ReturnType<typeof useSearchQueryState>,
  visibility: ReturnType<typeof useSearchVisibilityState>,
  nav: ReturnType<typeof useSearchNavigation>
): TitleSearchState {
  return {
    activeMatch: queryState.activeMatch,
    activeMatchIndex: queryState.activeMatchIndex,
    closeSearch: visibility.closeSearch,
    confirmSearch: visibility.confirmSearch,
    isSearchFocused: visibility.isSearchFocused,
    isSearchOpen: visibility.isSearchOpen,
    matches: queryState.matches,
    nextMatch: nav.nextMatch,
    openSearch: visibility.openSearch,
    previousMatch: nav.previousMatch,
    query: queryState.query,
    setQuery: queryState.setQuery
  };
}

/**
 * Controller hook providing in-page title search, keybindings, and match navigation.
 *
 * @example const search = useListTitleSearch({ items, selectedId, setSelectedId });
 */
export function useListTitleSearch(options: UseListTitleSearchOptions): TitleSearchState {
  const { items, selectedId, setSelectedId, screen, zone, disabled = false } = options;
  const queryState = useSearchQueryState(items, selectedId, setSelectedId);
  const visibility = useSearchVisibilityState(disabled, queryState.clear);
  const nav = useSearchNavigation(queryState.matches, queryState.activeMatchIndex, queryState.setActiveMatchIndex, setSelectedId);

  const actions = useMemo(
    () => ({ close: visibility.closeSearch, next: nav.nextMatch, open: visibility.openSearch, prev: nav.previousMatch }),
    [visibility.closeSearch, nav.nextMatch, visibility.openSearch, nav.previousMatch]
  );
  useSearchKeybinds(disabled, visibility.isSearchOpen, queryState.query, actions, screen, zone);

  return assembleSearchState(queryState, visibility, nav);
}
