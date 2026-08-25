import { apiJson } from "../../lib/api/apiClient.ts";
import { processStuff, updateStuffBody, updateStuffTitle } from "../inbox/api.ts";
import type { ItemBody, Stuff } from "../inbox/types";
import { processStuffToCalendar } from "../calendar/api.ts";
import type { CalendarConversionPayload } from "../calendar/types";

export type ProjectItemKind = "STUFF" | "NEXT_ACTION" | "CALENDAR";

export type ProjectItem = Stuff & {
  kind: ProjectItemKind;
  projectId: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  deadline?: string | null;
};

type ProjectItemResponse = ProjectItem & {
  body: ItemBody | string | null;
};

export async function fetchProjectActions(projectId: string): Promise<ProjectItem[]> {
  const response = await apiJson<ProjectItemResponse[]>(`/projects/${projectId}/items/actions`);
  return response.map(toProjectItem);
}

export async function createProjectStuff(projectId: string, title: string): Promise<ProjectItem> {
  const response = await apiJson<ProjectItemResponse>(`/projects/${projectId}/items/stuff`, jsonRequest("POST", { title }));
  return toProjectItem(response);
}

export async function updateProjectItemTitle(item: ProjectItem, title: string): Promise<ProjectItem> {
  const updated = await updateStuffTitle(item, title);
  return { ...item, title: updated.title, body: updated.body };
}

export async function updateProjectItemBody(item: ProjectItem, body: ItemBody): Promise<ProjectItem> {
  const updated = await updateStuffBody(item, body);
  return { ...item, title: updated.title, body: updated.body };
}

export async function processProjectStuff(item: ProjectItem, energy: number | null, minutes: number | null, contextIds: string[], deadline: string | null): Promise<void> {
  await processStuff(item, energy, minutes, contextIds, deadline);
}

export async function processProjectStuffToCalendar(item: ProjectItem, payload: CalendarConversionPayload): Promise<void> {
  await processStuffToCalendar(item, payload);
}

function jsonRequest(method: string, payload: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

function toProjectItem(item: ProjectItemResponse): ProjectItem {
  return { ...item, body: normalizeBody(item.body) };
}

function normalizeBody(body: ProjectItemResponse["body"]): ItemBody {
  if (!body) return { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
  if (typeof body === "string") return { text: body, inlineMarks: [], lineBlocks: [], blockEntities: [] };
  return body;
}
