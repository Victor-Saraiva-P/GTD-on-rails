import type { ItemBody, Stuff } from "../inbox/types";
import type { NextActionResponse, ScheduleWindow } from "../next-actions/types";
import { normalizeNextActionBody, parseEstimatedTime } from "../next-actions/types.ts";

export type CalendarStatus = "CALENDAR" | "ONGOING" | "DONE";
export type CalendarEntrySourceKind = "CALENDAR" | "NEXT_ACTION";
export type CalendarTemporalState = "SCHEDULED_TODAY" | "OVERDUE" | "DUE_TODAY" | "WEEK" | "DONE_TODAY";

export type Calendar = Stuff & {
  scheduledDate: string;
  scheduledTime: string | null;
  status: CalendarStatus;
  schedule?: ScheduleWindow;
};

export type CalendarPatch = {
  scheduledDate?: string;
  scheduledTime?: string | null;
};

export type CalendarConversionPayload = {
  scheduledDate: string;
  scheduledTime?: string | null;
};

type CalendarEntryBase = Stuff & {
  temporalState: CalendarTemporalState;
  status: string;
  schedule?: ScheduleWindow;
};

export type CalendarItemEntry = CalendarEntryBase & {
  sourceKind: "CALENDAR";
  status: CalendarStatus;
  scheduledDate: string;
  scheduledTime: string | null;
  deadline: null;
};

export type NextActionCalendarEntry = CalendarEntryBase & {
  sourceKind: "NEXT_ACTION";
  scheduledDate: null;
  scheduledTime: null;
  deadline: string;
  energy?: number | null;
  estimatedTime?: { hours: number; minutes: number } | null;
  contexts?: Array<{ id: string; name: string; iconUrl?: string }>;
};

export type CalendarEntry = CalendarItemEntry | NextActionCalendarEntry;
export type CalendarWorkspaceItem = Calendar | CalendarEntry;

export type CalendarEntryResponse = {
  id: string;
  sourceKind: CalendarEntrySourceKind;
  temporalState: CalendarTemporalState;
  title: string;
  body: ItemBody | string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  deadline?: string | null;
  status: string;
  schedule?: ScheduleWindow;
  energy?: NextActionResponse["energy"];
  estimatedTime?: NextActionResponse["estimatedTime"];
  contexts?: NextActionResponse["contexts"];
  projectId?: string | null;
  projectTitle?: string | null;
};

export type CalendarResponse = {
  id: string;
  title: string;
  body: ItemBody | string | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  status: CalendarStatus;
  schedule?: ScheduleWindow;
  projectId?: string | null;
  projectTitle?: string | null;
};

/**
 * Converts nullable API body formats into the shared calendar body shape.
 *
 * @example normalizeCalendarBody("notes")
 */
export function normalizeCalendarBody(body: CalendarResponse["body"]): ItemBody {
  return normalizeNextActionBody(body);
}

/**
 * Reports whether a Calendar workspace row is a projected Next Action.
 *
 * @example isNextActionCalendarEntry(entry)
 */
export function isNextActionCalendarEntry(item: CalendarWorkspaceItem): item is NextActionCalendarEntry {
  return "sourceKind" in item && item.sourceKind === "NEXT_ACTION";
}

/**
 * Returns the date that places an item in a Calendar day column.
 *
 * @example calendarWorkspaceItemDate(entry)
 */
export function calendarWorkspaceItemDate(item: CalendarWorkspaceItem): string | null {
  return isNextActionCalendarEntry(item) ? item.deadline ?? null : item.scheduledDate;
}

/**
 * Converts one aggregated Calendar API response without changing its source identity.
 *
 * @example toCalendarEntry({ sourceKind: "NEXT_ACTION", temporalState: "DUE_TODAY", ...response })
 */
export function toCalendarEntry(item: CalendarEntryResponse): CalendarEntry {
  const base = {
    id: item.id, title: item.title, body: normalizeNextActionBody(item.body), bodyLoaded: item.body != null,
    temporalState: item.temporalState, status: item.status, schedule: item.schedule,
    projectId: item.projectId ?? null, projectTitle: item.projectTitle ?? null, createdAt: ""
  };
  if (item.sourceKind === "CALENDAR") {
    if (!item.scheduledDate) throw new Error(`calendar entry '${item.id}' is missing scheduledDate`);
    return { ...base, sourceKind: "CALENDAR", status: item.status as CalendarStatus, scheduledDate: item.scheduledDate, scheduledTime: item.scheduledTime ?? null, deadline: null };
  }
  if (!item.deadline) throw new Error(`next action calendar entry '${item.id}' is missing deadline`);
  return {
    ...base, sourceKind: "NEXT_ACTION", scheduledDate: null, scheduledTime: null, deadline: item.deadline,
    energy: item.energy == null ? null : Number(item.energy), estimatedTime: parseEstimatedTime(item.estimatedTime), contexts: item.contexts ?? []
  };
}
