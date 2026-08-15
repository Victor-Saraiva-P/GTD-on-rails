import type { RecurringCalendarTemplate } from "./types";

export type RecurringCalendarTemplateSelectionCursor = {
  templates: RecurringCalendarTemplate[];
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
};

/**
 * Returns the currently selected recurring template or falls back to the first template.
 *
 * @example selectedRecurringCalendarTemplate(templates, "id-1")
 */
export function selectedRecurringCalendarTemplate(
  templates: RecurringCalendarTemplate[],
  selectedId: string | null
): RecurringCalendarTemplate | null {
  return templates.find((template) => template.id === selectedId) ?? templates[0] ?? null;
}

/**
 * Returns the 0-based index of the selected recurring template.
 *
 * @example selectedRecurringCalendarTemplateIndex(templates, template)
 */
export function selectedRecurringCalendarTemplateIndex(
  templates: RecurringCalendarTemplate[],
  template: RecurringCalendarTemplate | null
): number {
  return template ? templates.findIndex((candidate) => candidate.id === template.id) : -1;
}

/**
 * Computes a clamped index offset for recurring template selection navigation.
 *
 * @example recurringCalendarTemplateSelectionOffsetIndex(cursor, 1)
 */
export function recurringCalendarTemplateSelectionOffsetIndex(
  cursor: Pick<RecurringCalendarTemplateSelectionCursor, "templates" | "selectedIndex">,
  offset: number
): number | null {
  if (cursor.templates.length === 0) return null;
  return Math.min(Math.max(cursor.selectedIndex + offset, 0), cursor.templates.length - 1);
}

/**
 * Moves recurring template selection by an offset, clamping at list boundaries.
 *
 * @example moveRecurringCalendarTemplateSelection(cursor, 1)
 */
export function moveRecurringCalendarTemplateSelection(
  cursor: RecurringCalendarTemplateSelectionCursor,
  offset: number
): void {
  const nextIndex = recurringCalendarTemplateSelectionOffsetIndex(cursor, offset);
  if (nextIndex === null) return;
  cursor.setSelectedId(cursor.templates[nextIndex].id);
}

/**
 * Selects the first or last recurring template in the list.
 *
 * @example selectRecurringCalendarTemplateBoundary(cursor, "first")
 */
export function selectRecurringCalendarTemplateBoundary(
  cursor: RecurringCalendarTemplateSelectionCursor,
  boundary: "first" | "last"
): void {
  if (cursor.templates.length === 0) return;
  const index = boundary === "first" ? 0 : cursor.templates.length - 1;
  cursor.setSelectedId(cursor.templates[index].id);
}
