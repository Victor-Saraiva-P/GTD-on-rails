import type { Calendar } from "./types";
import {
  actualCalendarScheduleLabel,
  statedCalendarScheduleLabel
} from "./calendarDateUtils.ts";

export type CalendarDetailMetadata = {
  title: string;
  statedSchedule: string;
  actualSchedule: string | null;
};

/**
 * Builds detail header metadata without exposing calendar status.
 *
 * @example calendarDetailMetadata(calendar).statedSchedule
 */
export function calendarDetailMetadata(item: Calendar): CalendarDetailMetadata {
  return {
    title: item.title,
    statedSchedule: statedCalendarScheduleLabel(item.scheduledDate, item.scheduledTime) ?? item.scheduledDate,
    actualSchedule: actualCalendarScheduleLabel(item.schedule)
  };
}
