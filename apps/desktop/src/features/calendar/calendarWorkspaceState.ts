import type { Calendar } from "./types";
import type { FocusZoneId } from "../keybinds/types";

export type CalendarSubview = "today" | "weekly" | "recurring" | "completed" | "deleted";
export type CalendarPanel = "due" | "done-today" | "recurring" | "completed" | "deleted" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type CalendarSubviewDirection = "next" | "previous";
export type WeeklyDayPanel = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type ColumnShiftDirection = "left" | "right";

/** Inner shift stays within the same week. */
type InnerColumnShift = { kind: "inner"; panel: WeeklyDayPanel };
/** Boundary shift crosses into a different week. */
type BoundaryColumnShift = { kind: "boundary"; panel: WeeklyDayPanel; weekOffsetDelta: number };
export type WeeklyColumnShiftResult = InnerColumnShift | BoundaryColumnShift;

const weeklyDayOrder: WeeklyDayPanel[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * Resolves h/l column navigation for the weekly view (REQ-02, REQ-03, REQ-04).
 * Returns an inner shift or a boundary-crossing shift with the week offset delta.
 *
 * @example resolveWeeklyColumnShift("mon", "left") // { kind: "boundary", panel: "sun", weekOffsetDelta: -1 }
 */
export function resolveWeeklyColumnShift(
  currentDay: WeeklyDayPanel,
  direction: ColumnShiftDirection
): WeeklyColumnShiftResult {
  const index = weeklyDayOrder.indexOf(currentDay);
  const offset = direction === "right" ? 1 : -1;
  const nextIndex = index + offset;
  if (nextIndex >= 0 && nextIndex < weeklyDayOrder.length) {
    return { kind: "inner", panel: weeklyDayOrder[nextIndex] };
  }
  // Boundary crossing: left from Monday → previous week Sunday, right from Sunday → next week Monday
  return { kind: "boundary", panel: weeklyDayOrder[nextIndex < 0 ? 6 : 0], weekOffsetDelta: offset };
}

const calendarSubviewOrder: CalendarSubview[] = ["today", "weekly", "recurring", "completed", "deleted"];

export type CalendarSelectionCursor = {
  items: Calendar[];
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
};

export function calendarItemsForPanel(
  dueCalendars: Calendar[],
  doneTodayCalendars: Calendar[],
  completedCalendars: Calendar[],
  deletedCalendars: Calendar[],
  weeklyCalendars: Calendar[],
  activePanel: CalendarPanel
): Calendar[] {
  switch (activePanel) {
    case "done-today": return doneTodayCalendars;
    case "recurring": return [];
    case "completed": return completedCalendars;
    case "deleted": return deletedCalendars;
    case "mon": return weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === 1);
    case "tue": return weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === 2);
    case "wed": return weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === 3);
    case "thu": return weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === 4);
    case "fri": return weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === 5);
    case "sat": return weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === 6);
    case "sun": return weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === 0);
    default: return dueCalendars;
  }
}

/**
 * Replaces a calendar in a local collection after a successful mutation.
 *
 * @example calendarListWithReplacement(items, updated)
 */
export function calendarListWithReplacement(items: Calendar[], updated: Calendar): Calendar[] {
  return items.map((item) => item.id === updated.id ? updated : item);
}

/**
 * Removes a calendar from a local collection.
 *
 * @example calendarListWithoutItem(items, "calendar-id")
 */
export function calendarListWithoutItem(items: Calendar[], id: string): Calendar[] {
  return items.filter((item) => item.id !== id);
}

/**
 * Upserts a done calendar only when its actual end date is today.
 *
 * @example calendarTodayDoneListAfterDone(items, doneCalendar, "2026-05-21")
 */
export function calendarTodayDoneListAfterDone(items: Calendar[], updated: Calendar, today: string): Calendar[] {
  if (updated.status !== "DONE" || updated.schedule?.dateEnd !== today) return items;
  const withoutUpdated = calendarListWithoutItem(items, updated.id);
  return [...withoutUpdated, updated];
}

export function selectedCalendar(
  items: Calendar[],
  selectedId: string | null
): Calendar | null {
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

export function selectedCalendarIndex(
  items: Calendar[],
  item: Calendar | null
): number {
  return item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
}

export function calendarSelectionOffsetIndex(
  cursor: Pick<CalendarSelectionCursor, "items" | "selectedIndex">,
  offset: number
): number | null {
  if (cursor.items.length === 0) return null;
  return Math.min(Math.max(cursor.selectedIndex + offset, 0), cursor.items.length - 1);
}

export function moveCalendarSelection(
  cursor: CalendarSelectionCursor,
  offset: number
): void {
  const nextIndex = calendarSelectionOffsetIndex(cursor, offset);
  if (nextIndex === null) return;
  cursor.setSelectedId(cursor.items[nextIndex].id);
}

export function selectCalendarBoundary(
  cursor: CalendarSelectionCursor,
  boundary: "first" | "last"
): void {
  if (cursor.items.length === 0) return;
  const index = boundary === "first" ? 0 : cursor.items.length - 1;
  cursor.setSelectedId(cursor.items[index].id);
}

export function defaultCalendarPanelForSubview(subview: CalendarSubview): CalendarPanel {
  if (subview === "weekly") return "mon";
  if (subview === "recurring") return "recurring";
  if (subview === "completed") return "completed";
  if (subview === "deleted") return "deleted";
  return "due";
}

export function calendarSubviewTarget(
  current: CalendarSubview,
  direction: CalendarSubviewDirection
): { panel: CalendarPanel; subview: CalendarSubview } {
  const offset = direction === "next" ? 1 : -1;
  const currentIndex = calendarSubviewOrder.indexOf(current);
  const nextIndex = (currentIndex + offset + calendarSubviewOrder.length) % calendarSubviewOrder.length;
  const subview = calendarSubviewOrder[nextIndex];
  return { panel: defaultCalendarPanelForSubview(subview), subview };
}

export function calendarSubviewFocusZones(subview: CalendarSubview): FocusZoneId[] {
  if (subview === "completed") return ["calendar-completed-panel", "calendar-detail"];
  if (subview === "deleted") return ["calendar-deleted-panel", "calendar-detail"];
  if (subview === "recurring") return ["calendar-recurring-panel", "calendar-detail"];
  if (subview === "weekly") return ["calendar-mon-panel", "calendar-tue-panel", "calendar-wed-panel", "calendar-thu-panel", "calendar-fri-panel", "calendar-sat-panel", "calendar-sun-panel"];
  return ["calendar-today-due-panel", "calendar-today-done-panel", "calendar-detail"];
}
