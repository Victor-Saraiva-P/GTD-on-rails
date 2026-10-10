import { ApiRequestError } from "../../lib/api/apiClient.ts";

/**
 * Formats Calendar load failures for user-facing retry states.
 *
 * @example calendarLoadErrorMessage(new Error("offline"))
 */
export function calendarLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return `Failed to load calendars (${error.status})`;
  if (error instanceof Error) return error.message;
  return "Failed to load calendars";
}
