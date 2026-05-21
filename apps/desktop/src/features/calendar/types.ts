import type { ItemBody, Stuff } from "../inbox/types";
import type { ScheduleWindow } from "../next-actions/types";
import { normalizeNextActionBody } from "../next-actions/types.ts";

export type CalendarStatus = "CALENDAR" | "ONGOING" | "DONE";

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

export type CalendarResponse = {
  id: string;
  title: string;
  body: ItemBody | string | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  status: CalendarStatus;
  schedule?: ScheduleWindow;
};

/**
 * Converts nullable API body formats into the shared calendar body shape.
 *
 * @example normalizeCalendarBody("notes")
 */
export function normalizeCalendarBody(body: CalendarResponse["body"]): ItemBody {
  return normalizeNextActionBody(body);
}
