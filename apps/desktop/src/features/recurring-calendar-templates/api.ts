import { apiFetch, apiJson } from "../../lib/api/apiClient.ts";
import type { Stuff } from "../inbox/types";
import type {
  RecurringCalendarTemplate,
  RecurringCalendarTemplateConversionPayload,
  RecurringCalendarTemplateResponse,
  RecurringCalendarTemplateUpdate
} from "./types.ts";
import { toRecurringCalendarTemplate } from "./types.ts";

/**
 * Loads active Recurring Calendar Templates from the API.
 *
 * @example await fetchRecurringCalendarTemplates()
 */
export async function fetchRecurringCalendarTemplates(): Promise<RecurringCalendarTemplate[]> {
  const response = await apiJson<RecurringCalendarTemplateResponse[]>("/recurring-calendar-templates");
  return response.map(toRecurringCalendarTemplate);
}

/**
 * Converts inbox stuff into a Recurring Calendar Template.
 *
 * @example await processStuffToRecurringCalendarTemplate(stuff, payload)
 */
export async function processStuffToRecurringCalendarTemplate(
  item: Stuff,
  payload: RecurringCalendarTemplateConversionPayload
): Promise<RecurringCalendarTemplate> {
  const response = await apiJson<RecurringCalendarTemplateResponse>(
    `/inbox/${item.id}/recurring-calendar-template`, jsonRequest("POST", payload));
  return toRecurringCalendarTemplate(response);
}

/**
 * Updates a Recurring Calendar Template.
 *
 * @example await patchRecurringCalendarTemplate(id, payload)
 */
export async function patchRecurringCalendarTemplate(
  id: string,
  payload: RecurringCalendarTemplateUpdate
): Promise<RecurringCalendarTemplate> {
  const response = await apiJson<RecurringCalendarTemplateResponse>(
    `/recurring-calendar-templates/${id}`, jsonRequest("PATCH", payload));
  return toRecurringCalendarTemplate(response);
}

/**
 * Deletes a Recurring Calendar Template.
 *
 * @example await deleteRecurringCalendarTemplate(id)
 */
export async function deleteRecurringCalendarTemplate(id: string): Promise<void> {
  await apiFetch(`/recurring-calendar-templates/${id}`, { method: "DELETE" });
}

/**
 * Restores a deleted Recurring Calendar Template.
 *
 * @example await restoreRecurringCalendarTemplate(id)
 */
export async function restoreRecurringCalendarTemplate(id: string): Promise<RecurringCalendarTemplate> {
  const response = await apiJson<RecurringCalendarTemplateResponse>(
    `/recurring-calendar-templates/${id}/restore`, { method: "POST" });
  return toRecurringCalendarTemplate(response);
}

function jsonRequest(method: string, payload: object): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };
}
