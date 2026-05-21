import type { Calendar } from "./types";

export type CalendarSubview = "today" | "weekly" | "completed" | "deleted";
export type CalendarPanel = "due" | "done-today";

export type CalendarSelectionCursor = {
  items: Calendar[];
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
};

export function calendarItemsForPanel(
  dueCalendars: Calendar[],
  doneTodayCalendars: Calendar[],
  activePanel: CalendarPanel
): Calendar[] {
  return activePanel === "done-today" ? doneTodayCalendars : dueCalendars;
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
