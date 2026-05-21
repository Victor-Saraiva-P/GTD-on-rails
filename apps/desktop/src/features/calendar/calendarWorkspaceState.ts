import type { Calendar } from "./types";

export type CalendarSubview = "today" | "weekly" | "completed" | "deleted";
export type CalendarPanel = "due" | "done-today" | "completed" | "deleted" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

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
