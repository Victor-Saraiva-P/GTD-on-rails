import type { ItemBody } from "../inbox/types";
import { normalizeCalendarBody } from "../calendar/types.ts";

export type RecurrenceUnit = "day" | "week" | "month" | "year";

export type RecurringCalendarTemplate = {
  id: string;
  title: string;
  body: ItemBody;
  startDate: string;
  scheduledTime: string | null;
  intervalValue: number;
  recurrenceUnit: RecurrenceUnit;
  weeklyWeekdays: string[];
  endDate: string | null;
};

export type RecurringCalendarTemplateUpdate = {
  title: string;
  startDate: string;
  scheduledTime: string | null;
  intervalValue: number;
  recurrenceUnit: RecurrenceUnit;
  weeklyWeekdays: string[];
  endDate: string | null;
};

export type RecurringCalendarTemplateConversionPayload = Omit<RecurringCalendarTemplateUpdate, "title">;

export type RecurringCalendarTemplateResponse = Omit<RecurringCalendarTemplate, "body"> & {
  body: ItemBody | string | null;
};

export function toRecurringCalendarTemplate(
  item: RecurringCalendarTemplateResponse
): RecurringCalendarTemplate {
  return { ...item, body: normalizeCalendarBody(item.body), scheduledTime: item.scheduledTime ?? null, endDate: item.endDate ?? null };
}
