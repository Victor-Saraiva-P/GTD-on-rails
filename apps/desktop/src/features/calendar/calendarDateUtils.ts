import { formatScheduleDateTime, type ScheduleWindow } from "../next-actions/types.ts";
import { clockTimeDisplayValue } from "../processing/processingFlow.ts";

import type { WeeklyDayPanel } from "./calendarWorkspaceState.ts";
import type { Calendar, CalendarPatch } from "./types.ts";

export type WeekMovement = "previous" | "next";

const weeklyPanelByDateIndex: WeeklyDayPanel[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Returns the Monday of the week containing `d`. Week starts on Monday (REQ-06). */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
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

/**
 * Normalizes API clock values for human calendar display.
 *
 * @example trimCalendarDisplayTime("21:00:00")
 */
export function trimCalendarDisplayTime(time?: string | null): string | null {
  if (!time) return null;
  const match = /^(\d{2}:\d{2})/.exec(time);
  return match ? match[1] : time;
}

/**
 * Formats the stated calendar date and optional time.
 *
 * @example statedCalendarScheduleLabel("2026-05-21", "21:00:00")
 */
export function statedCalendarScheduleLabel(date: string, time?: string | null): string | null {
  return scheduleDateTimeLabel(date, time);
}

/**
 * Formats the actual calendar schedule window with next-action arrow style.
 *
 * @example actualCalendarScheduleLabel({ dateStart: "2026-05-21" })
 */
export function actualCalendarScheduleLabel(schedule?: ScheduleWindow): string | null {
  const startedAt = scheduleDateTimeLabel(schedule?.dateStart, schedule?.timeStart);
  const endedAt = scheduleDateTimeLabel(schedule?.dateEnd, schedule?.timeEnd);
  if (!startedAt) return endedAt;
  return endedAt ? `${startedAt} → ${endedAt}` : startedAt;
}

/**
 * Resolves week-level navigation offsets.
 *
 * @example resolveWeeklyOffset(0, "next")
 */
export function resolveWeeklyOffset(currentOffset: number, movement: WeekMovement): number {
  return currentOffset + (movement === "next" ? 1 : -1);
}

/**
 * Resolves the weekly panel for today's date.
 *
 * @example resolveTodayWeeklyPanel(new Date())
 */
export function resolveTodayWeeklyPanel(today: Date): WeeklyDayPanel {
  return weeklyPanelByDateIndex[today.getDay()];
}

/**
 * Builds the initial schedule edit draft from the selected calendar.
 *
 * @example initialCalendarScheduleDraft(calendar)
 */
export function initialCalendarScheduleDraft(item: Calendar): { scheduledDate: string; timeDigits: string } {
  return {
    scheduledDate: item.scheduledDate,
    timeDigits: calendarTimeDigits(item.scheduledTime)
  };
}

/**
 * Builds a calendar schedule patch from dialog state.
 *
 * @example saveCalendarScheduleDraft("2026-05-21", "0930")
 */
export function saveCalendarScheduleDraft(scheduledDate: string, timeDigits: string): CalendarPatch {
  return {
    scheduledDate,
    scheduledTime: clockTimeDisplayValue(timeDigits) || null
  };
}

function scheduleDateTimeLabel(date?: string | null, time?: string | null): string | null {
  const formattedDate = calendarDateLabel(date);
  const formattedTime = trimCalendarDisplayTime(time);
  if (!formattedDate) return null;
  return formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;
}

function calendarDateLabel(date?: string | null): string | null {
  if (!date) return null;
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return formatScheduleDateTime(date, null);
  // Enforce dd/mm/yyyy everywhere in the desktop app.
  return `${day}/${month}/${year}`;
}

function calendarTimeDigits(time?: string | null): string {
  return trimCalendarDisplayTime(time)?.replace(":", "") ?? "";
}
