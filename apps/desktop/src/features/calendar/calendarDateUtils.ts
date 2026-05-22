/**
 * Calendar date utilities for week navigation.
 *
 * Extracted from useCalendarQuery to enable unit testing
 * of offset-based Monday calculation (REQ-01).
 */

/** Returns the Monday of the week containing `d`. Week starts on Monday (REQ-06). */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

/** Formats a Date as "YYYY-MM-DD" for the calendar API. */
export function formatCalendarDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the Monday shifted by `weekOffset` weeks from the current week.
 *
 * @example getMondayForOffset(0)  // this week's Monday
 * @example getMondayForOffset(-1) // last week's Monday
 * @example getMondayForOffset(2)  // two weeks from now's Monday
 */
export function getMondayForOffset(weekOffset: number): Date {
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  return monday;
}
