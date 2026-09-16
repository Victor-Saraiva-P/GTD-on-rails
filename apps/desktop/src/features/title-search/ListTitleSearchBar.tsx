import { useEffect, useRef, type KeyboardEvent } from "react";
import type { TitleSearchState } from "./types";

type ListTitleSearchBarProps = Readonly<{
  search: TitleSearchState;
}>;

function resolveSearchCountBadge(query: string, activeIndex: number, total: number): string | null {
  if (!query.trim()) return null;
  if (total === 0) return "[0/0]";
  return `[${activeIndex + 1}/${total}]`;
}

function focusActiveListEntry(): void {
  const activeEntry = document.querySelector<HTMLElement>(
    ".tree-entry--active, .project-card--active, [aria-selected='true']"
  );
  if (activeEntry) activeEntry.focus();
}

function handleSearchInputKeyDown(event: KeyboardEvent<HTMLInputElement>, search: TitleSearchState): void {
  if (event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.blur();
    search.confirmSearch();
    focusActiveListEntry();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.currentTarget.blur();
    search.closeSearch();
    focusActiveListEntry();
    return;
  }
  if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n")) {
    event.preventDefault();
    search.nextMatch();
    return;
  }
  if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) {
    event.preventDefault();
    search.previousMatch();
  }
}

function ListTitleSearchPrompt() {
  return (
    <span className="list-title-search__prompt" aria-hidden="true">
      <span className="list-title-search__icon">Q</span>
      <span className="list-title-search__chevron">︾</span>
    </span>
  );
}

function ListTitleSearchHints() {
  return (
    <div className="list-title-search__hints" aria-hidden="true">
      <span className="list-title-search__hint"><kbd>n</kbd>/<kbd>N</kbd> next/prev</span>
      <span className="list-title-search__hint"><kbd>Enter</kbd> focus</span>
      <span className="list-title-search__hint"><kbd>Esc</kbd> exit</span>
    </div>
  );
}

type SearchInputProps = Readonly<{
  inputRef: React.RefObject<HTMLInputElement | null>;
  search: TitleSearchState;
}>;

function ListTitleSearchInput({ inputRef, search }: SearchInputProps) {
  return (
    <input
      ref={inputRef}
      className="list-title-search__input"
      type="text"
      value={search.query}
      placeholder="Search item titles..."
      aria-label="Search item titles"
      onChange={(e) => search.setQuery(e.target.value)}
      onKeyDown={(e) => handleSearchInputKeyDown(e, search)}
    />
  );
}

/**
 * Renders the bottom LazyVim-inspired search bar for in-page list title search.
 *
 * @example <ListTitleSearchBar search={searchState} />
 */
export function ListTitleSearchBar({ search }: ListTitleSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search.isSearchFocused) {
      inputRef.current?.focus();
    }
  }, [search.isSearchFocused]);

  const countBadge = resolveSearchCountBadge(search.query, search.activeMatchIndex, search.matches.length);

  return (
    <div className="list-title-search-bar" role="search" aria-label="Title search">
      <ListTitleSearchPrompt />
      <ListTitleSearchInput inputRef={inputRef} search={search} />
      {countBadge ? <span className="list-title-search__count">{countBadge}</span> : null}
      <ListTitleSearchHints />
    </div>
  );
}
