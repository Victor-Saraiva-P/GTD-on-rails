const ZONE_DETAIL_MAP: Readonly<Record<string, string>> = {
  "inbox-list": "stuff-detail",
  "deleted-inbox-list": "stuff-detail",
  "next-actions-list": "next-action-detail",
  "done-next-actions-list": "done-next-action-detail",
  "deleted-next-actions-list": "deleted-next-action-detail",
  "ongoing-next-actions-list": "ongoing-next-action-detail",
  "someday-maybe-list": "someday-maybe-detail",
  "deleted-someday-maybe-list": "someday-maybe-detail",
  "project-actions-list": "project-item-detail",
  "calendars-today": "calendar-detail",
  "calendars-weekly": "calendar-detail"
};

/**
 * Resolves the matching detail zone for a given list focus zone when entering Zen Mode.
 *
 * @example resolveZenDetailZone("inbox-list") // "stuff-detail"
 */
export function resolveZenDetailZone(activeZone: string): string | null {
  return ZONE_DETAIL_MAP[activeZone] ?? null;
}
