import type { ItemBody, Stuff } from "../inbox/types";

export type NextActionOrder = "energy" | "time";

export type NextAction = Stuff & {
  schedule?: unknown;
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
  schedule?: unknown;
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
