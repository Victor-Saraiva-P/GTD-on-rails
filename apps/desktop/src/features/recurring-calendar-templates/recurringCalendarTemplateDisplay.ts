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

function formatTemplateDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
