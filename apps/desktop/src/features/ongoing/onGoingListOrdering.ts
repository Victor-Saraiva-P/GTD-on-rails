import type { NextAction } from "../next-actions/types.ts";
import type { Calendar } from "../calendar/types.ts";
import type { OnGoingItemSelection } from "./combinedOnGoingState.ts";

export function mergeAndSortOnGoingItems(
  nextActions: NextAction[],
  calendars: Calendar[]
): OnGoingItemSelection[] {
  const merged: OnGoingItemSelection[] = [
    ...nextActions.map((item) => ({ type: "next-action" as const, item })),
    ...calendars.map((item) => ({ type: "calendar" as const, item }))
  ];

  merged.sort((a, b) => {
    const aStart = formatSchedule(a.item.schedule?.dateStart, a.item.schedule?.timeStart);
    const bStart = formatSchedule(b.item.schedule?.dateStart, b.item.schedule?.timeStart);

    if (!aStart && !bStart) return 0;
    if (!aStart) return 1;
    if (!bStart) return -1;

    return aStart.localeCompare(bStart);
  });

  return merged;
}

function formatSchedule(date?: string | null, time?: string | null): string | null {
  if (!date) return null;
  if (!time) return date; // For all-day comparisons, just use date
  return `${date}T${time}`;
}
