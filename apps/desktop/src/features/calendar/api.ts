import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import { deleteStuff, updateStuffBody, updateStuffTitle } from "../inbox/api.ts";
import type { ItemBody, Stuff } from "../inbox/types";
import type { Calendar, CalendarConversionPayload, CalendarPatch, CalendarResponse } from "./types";
import { normalizeCalendarBody } from "./types.ts";

/**
 * Loads due or late calendars for today's first panel.
 *
 * @example await fetchTodayCalendars()
 */
export async function fetchTodayCalendars(): Promise<Calendar[]> {
  const response = await apiJson<CalendarResponse[]>("/calendars/today");
  return response.map(toCalendar);
}

/**
 * Loads calendars completed today.
 *
 * @example await fetchDoneTodayCalendars()
 */
export async function fetchDoneTodayCalendars(): Promise<Calendar[]> {
  const response = await apiJson<CalendarResponse[]>("/calendars/done/today");
  return response.map(toCalendar);
}

/**
 * Loads calendars for a seven-day range starting at the supplied date.
 *
 * @example await fetchWeekCalendars("2026-05-18")
 */
export async function fetchWeekCalendars(start: string): Promise<Calendar[]> {
  const response = await apiJson<CalendarResponse[]>(`/calendars/week?start=${encodeURIComponent(start)}`);
  return response.map(toCalendar);
}

/**
 * Loads completed calendars.
 *
 * @example await fetchDoneCalendars()
 */
export async function fetchDoneCalendars(): Promise<Calendar[]> {
  const response = await apiJson<CalendarResponse[]>("/calendars/done");
  return response.map(toCalendar);
}

/**
 * Loads deleted calendars.
 *
 * @example await fetchDeletedCalendars()
 */
export async function fetchDeletedCalendars(): Promise<Calendar[]> {
  const response = await apiJson<CalendarResponse[]>("/calendars/deleted");
  return response.map(toCalendar);
}

/**
 * Loads ongoing calendars.
 *
 * @example await fetchOnGoingCalendars()
 */
export async function fetchOnGoingCalendars(): Promise<Calendar[]> {
  const response = await apiJson<CalendarResponse[]>("/calendars/ongoing");
  return response.map(toCalendar);
}

/**
 * Updates calendar scheduling attributes.
 *
 * @example await patchCalendar("id", { scheduledDate: "2026-05-21" })
 */
export async function patchCalendar(id: string, patch: CalendarPatch): Promise<Calendar> {
  const response = await apiJson<CalendarResponse>(`/calendars/${id}`, jsonRequest("PATCH", patch));
  return toCalendar(response);
}

/**
 * Marks a calendar ongoing.
 *
 * @example await markCalendarOnGoing(calendar.id)
 */
export async function markCalendarOnGoing(id: string): Promise<Calendar> {
  return postCalendarTransition(id, "ongoing");
}

/**
 * Marks a calendar done.
 *
 * @example await markCalendarDone(calendar.id)
 */
export async function markCalendarDone(id: string): Promise<Calendar> {
  return postCalendarTransition(id, "done");
}

/**
 * Resets a done or ongoing calendar to active calendar state.
 *
 * @example await resetCalendarStatus(calendar.id)
 */
export async function resetCalendarStatus(id: string): Promise<Calendar> {
  return postCalendarTransition(id, "reset-status");
}

/**
 * Recovers a deleted calendar.
 *
 * @example await recoverDeletedCalendar(calendar.id)
 */
export async function recoverDeletedCalendar(id: string): Promise<Calendar> {
  return postCalendarTransition(id, "recover");
}

/**
 * Converts inbox stuff into a calendar item.
 *
 * @example await processStuffToCalendar(stuff, { scheduledDate: "2026-05-21" })
 */
export async function processStuffToCalendar(
  item: Stuff,
  payload: CalendarConversionPayload
): Promise<void> {
  await apiFetch(`/inbox/${item.id}/calendar`, jsonRequest("POST", payload));
}

export { deleteStuff as deleteCalendar };

export function updateCalendarBody(item: Calendar, body: ItemBody): Promise<Calendar> {
  return updateStuffBody(item, body).then((updated) => ({ ...item, body: updated.body, title: updated.title }));
}

export function updateCalendarTitle(item: Calendar, title: string): Promise<Calendar> {
  return updateStuffTitle(item, title).then((updated) => ({ ...item, body: updated.body, title: updated.title }));
}

function postCalendarTransition(id: string, action: string): Promise<Calendar> {
  return apiJson<CalendarResponse>(`/calendars/${id}/${action}`, { method: "POST" }).then(toCalendar);
}

function jsonRequest(method: string, payload: object): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };
}

function toCalendar(item: CalendarResponse): Calendar {
  return {
    id: item.id,
    title: item.title,
    body: normalizeCalendarBody(item.body),
    scheduledDate: item.scheduledDate,
    scheduledTime: item.scheduledTime ?? null,
    status: item.status,
    schedule: item.schedule,
    createdAt: ""
  };
}
