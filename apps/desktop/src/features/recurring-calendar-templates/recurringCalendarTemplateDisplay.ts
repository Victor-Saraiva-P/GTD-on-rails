import type { RecurringCalendarTemplate } from "./types";

export type RecurringTemplateDetailMetadata = {
  recurrence: string;
  title: string;
};

/**
 * Builds the one-line recurrence summary shown in the Recurring Calendar Templates list.
 *
 * @example recurringTemplateRecurrenceLabel(template)
 */
export function recurringTemplateRecurrenceLabel(template: RecurringCalendarTemplate): string {
  const cadence = recurrenceCadenceText(template.intervalValue, template.recurrenceUnit);
  const time = template.scheduledTime ? ` at ${template.scheduledTime.slice(0, 5)}` : "";
  const endDate = template.endDate ? ` until ${formatTemplateDate(template.endDate)}` : "";
  return `${cadence} from ${formatTemplateDate(template.startDate)}${time}${endDate}`;
}

/**
 * Builds recurring template metadata for the detail pane.
 *
 * @example recurringTemplateDetailMetadata(template).recurrence
 */
export function recurringTemplateDetailMetadata(
  template: RecurringCalendarTemplate
): RecurringTemplateDetailMetadata {
  return { recurrence: recurringTemplateRecurrenceLabel(template), title: template.title };
}

/**
 * Returns a template list excluding the template with the given ID.
 *
 * @example recurringCalendarTemplateListWithoutItem(templates, "template-1")
 */
export function recurringCalendarTemplateListWithoutItem(
  templates: RecurringCalendarTemplate[],
  id: string
): RecurringCalendarTemplate[] {
  return templates.filter((template) => template.id !== id);
}

function recurrenceCadenceText(intervalValue: number, recurrenceUnit: string): string {
  const unit = intervalValue === 1 ? recurrenceUnit : `${recurrenceUnit}s`;
  return intervalValue === 1 ? `Every ${unit}` : `Every ${intervalValue} ${unit}`;
}

/**
 * Returns the uppercase English weekday name for an ISO YYYY-MM-DD date.
 *
 * @example weekdayName("2026-05-21")
 */
export function weekdayName(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "MONDAY";
  const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return weekdays[new Date(`${isoDate}T00:00:00`).getDay()];
}

function formatTemplateDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
