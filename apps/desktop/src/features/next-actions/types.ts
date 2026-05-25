import type { ItemBody, Stuff } from "../inbox/types";

export type NextActionOrder = "energy" | "time" | "priority";

export type ScheduleWindow = {
  dateStart?: string | null;
  dateEnd?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  allDay?: boolean;
};


export type NextAction = Stuff & {
  deadline?: string | null;
  schedule?: ScheduleWindow;
};

export type NextActionPatch = {
  energy?: number | null;
  estimatedTime?: { hours: number; minutes: number } | null;
  deadline?: string | null;
  clearDeadline?: boolean;
  contextIds?: string[];
};

export type NextActionResponse = {
  id: string;
  title: string;
  body: ItemBody | string | null;
  energy?: number | string | null;
  estimatedTime?: { hours: number; minutes: number } | string | null;
  deadline?: string | null;
  status: string;
  schedule?: ScheduleWindow;
  contexts?: Array<{ id: string; name: string; iconUrl?: string }>;
};

/**
 * Converts an ISO-8601 duration into the desktop estimated-time shape.
 *
 * @example parseEstimatedTime("PT1H30M")
 */
export function parseEstimatedTime(value: NextActionResponse["estimatedTime"]) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(value);
  if (!match) return null;
  return { hours: Number(match[1] ?? 0), minutes: Number(match[2] ?? 0) };
}

/**
 * Converts nullable API body formats into the shared item body shape.
 *
 * @example normalizeNextActionBody("notes")
 */
export function normalizeNextActionBody(body: NextActionResponse["body"]): ItemBody {
  if (!body) return { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
  if (typeof body === "string") return { text: body, inlineMarks: [], lineBlocks: [], blockEntities: [] };
  return body;
}

/**
 * Formats a schedule date and time into a localized string.
 */
export function formatScheduleDateTime(date?: string | null, time?: string | null): string | null {
  if (!date) return null;
  
  // Format as ISO string to ensure correct parsing: YYYY-MM-DDTHH:mm:ss
  const dateTimeString = time ? `${date}T${time}Z` : date;
  const dateObj = new Date(dateTimeString);
  
  if (isNaN(dateObj.getTime())) return null;

  const formatted = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(time ? { hour: "2-digit", minute: "2-digit", hour12: false } : {})
  }).format(dateObj);

  return formatted.replace(",", "");
}
