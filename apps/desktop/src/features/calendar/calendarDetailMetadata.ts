import type { Calendar } from "./types";

export type CalendarDetailMetadata = {
  title: string;
  parts: string[];
};

function scheduledDatePart(item: Calendar): string {
  return `scheduled: ${item.scheduledDate}`;
}

function scheduledTimePart(item: Calendar): string | null {
  return item.scheduledTime ? `time: ${item.scheduledTime}` : null;
}

/**
 * Builds detail header metadata without exposing calendar status.
 *
 * @example calendarDetailMetadata(calendar).parts
 */
export function calendarDetailMetadata(item: Calendar): CalendarDetailMetadata {
  const timePart = scheduledTimePart(item);
  const parts = timePart ? [scheduledDatePart(item), timePart] : [scheduledDatePart(item)];
  return { title: item.title, parts };
}
