import type { FocusZoneId, ScreenId } from "../keybinds/types";

export type SearchableItem = {
  id: string;
  title: string;
};

export type TitleSearchMatch = {
  id: string;
  title: string;
  index: number;
};

export type TitleSegment = {
  text: string;
  isMatch: boolean;
};

export type TitleSearchState = {
  query: string;
  isSearchOpen: boolean;
  isSearchFocused: boolean;
  matches: TitleSearchMatch[];
  activeMatchIndex: number;
  activeMatch: TitleSearchMatch | null;
  setQuery: (query: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  confirmSearch: () => void;
  nextMatch: () => void;
  previousMatch: () => void;
};

export type UseListTitleSearchOptions = {
  items: readonly SearchableItem[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  zone?: FocusZoneId | FocusZoneId[];
  screen?: ScreenId;
  disabled?: boolean;
};
