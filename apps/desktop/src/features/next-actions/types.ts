import type { ItemBody, Stuff } from "../inbox/types";

export type NextActionOrder = "energy" | "time";

export type ScheduleWindow = {
  dateStart?: string | null;
  dateEnd?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  allDay?: boolean;
};


export type NextAction = Stuff & {
  schedule?: ScheduleWindow;
};

export type NextActionPatch = {
  energy?: number | null;
  estimatedTime?: { hours: number; minutes: number } | null;
  contextIds?: string[];
};

export type NextActionResponse = {
  id: string;
  title: string;
  body: ItemBody | string | null;
  energy?: number | string | null;
  estimatedTime?: { hours: number; minutes: number } | string | null;
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
  const dateTimeString = time ? `${date}T${time}` : date;
  const dateObj = new Date(dateTimeString);
  
  if (isNaN(dateObj.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: time ? "short" : undefined
  }).format(dateObj);
}
