import { useTitleSearchContext } from "./TitleSearchContext";
import { splitTitleSegments } from "./titleSearchMatcher";
import type { TitleSegment } from "./types";

type TitleSearchHighlightProps = Readonly<{
  title: string;
  itemId: string;
}>;

function TitleSegmentSpan({ segment, isActive }: Readonly<{ segment: TitleSegment; isActive: boolean }>) {
  if (!segment.isMatch) {
    return <>{segment.text}</>;
  }

  const matchClass = isActive
    ? "title-search-match title-search-match--active"
    : "title-search-match";

  return <mark className={matchClass}>{segment.text}</mark>;
}

function resolveMatchBadge(isActive: boolean, activeIndex: number, totalMatches: number): string | null {
  if (!isActive || totalMatches <= 0) {
    return null;
  }
  return `[${activeIndex + 1}/${totalMatches}]`;
}

/**
 * Renders an item title with search query highlights and an active match badge.
 *
 * @example <TitleSearchHighlight title="Setup Database" itemId="stuff-1" />
 */
export function TitleSearchHighlight({ title, itemId }: TitleSearchHighlightProps) {
  const search = useTitleSearchContext();
  if (!search || !search.query.trim()) {
    return <>{title}</>;
  }

  const isMatched = search.matches.some((match) => match.id === itemId);
  if (!isMatched) {
    return <>{title}</>;
  }

  const isActive = search.activeMatch?.id === itemId;
  const segments = splitTitleSegments(title, search.query);
  const badgeLabel = resolveMatchBadge(isActive, search.activeMatchIndex, search.matches.length);

  return (
    <>
      {segments.map((segment, index) => (
        <TitleSegmentSpan key={`${index}-${segment.text}`} segment={segment} isActive={isActive} />
      ))}
      {badgeLabel ? <span className="title-search-badge">{badgeLabel}</span> : null}
    </>
  );
}
