import type { SearchableItem, TitleSearchMatch, TitleSegment } from "./types";

/**
 * Splits a title into matching and non-matching text segments for highlight rendering.
 *
 * @example splitTitleSegments("Database Setup", "data")
 */
export function splitTitleSegments(title: string, query: string): TitleSegment[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [{ isMatch: false, text: title }];
  }

  return collectTitleSegments(title, trimmed.toLowerCase());
}

function collectTitleSegments(title: string, lowerQuery: string): TitleSegment[] {
  const lowerTitle = title.toLowerCase();
  const segments: TitleSegment[] = [];
  let cursor = 0;

  while (cursor < title.length) {
    const matchIndex = lowerTitle.indexOf(lowerQuery, cursor);
    if (matchIndex === -1) {
      segments.push({ isMatch: false, text: title.slice(cursor) });
      break;
    }
    if (matchIndex > cursor) {
      segments.push({ isMatch: false, text: title.slice(cursor, matchIndex) });
    }
    const matchEnd = matchIndex + lowerQuery.length;
    segments.push({ isMatch: true, text: title.slice(matchIndex, matchEnd) });
    cursor = matchEnd;
  }

  return segments;
}

/**
 * Filters items whose title contains the query string (case-insensitively).
 *
 * @example computeTitleMatches([{ id: "1", title: "Task" }], "ta")
 */
export function computeTitleMatches(items: readonly SearchableItem[], query: string): TitleSearchMatch[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const matches: TitleSearchMatch[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.title.toLowerCase().includes(normalized)) {
      matches.push({ id: item.id, index: i, title: item.title });
    }
  }
  return matches;
}

/**
 * Calculates next or previous match index with wrap-around navigation.
 *
 * @example resolveNextMatchIndex(0, 3, 1)
 */
export function resolveNextMatchIndex(currentIndex: number, totalMatches: number, step: 1 | -1): number {
  if (totalMatches <= 0) {
    return -1;
  }
  if (currentIndex < 0) {
    return step === 1 ? 0 : totalMatches - 1;
  }
  return (currentIndex + step + totalMatches) % totalMatches;
}
