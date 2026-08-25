import { useEffect, useState } from "react";
import type { CalendarConversionPayload } from "../calendar/types";
import type { ItemBody } from "../inbox/types";
import { isSameBody } from "../inbox/types";
import { useActiveZone } from "../keybinds/hooks";
import type { Project } from "./types";
import { createProjectStuff, fetchProjectActions, processProjectStuff, processProjectStuffToCalendar, updateProjectItemBody, updateProjectItemTitle, type ProjectItem } from "./projectItems";

const DRAFT_PROJECT_ITEM_ID = "__draft_project_item__";

function draftProjectItem(projectId: string): ProjectItem {
  return { id: DRAFT_PROJECT_ITEM_ID, projectId, kind: "STUFF", title: "", status: "STUFF", body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] }, createdAt: new Date().toISOString() };
}

function useProjectActionsQuery(projectId: string | null) {
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const reload = () => void loadProjectActions(projectId, setItems, setErrorMessage, setIsLoading);
  useEffect(reload, [projectId]);
  return { errorMessage, isLoading, items, reload, setItems };
}

async function loadProjectActions(projectId: string | null, setItems: (items: ProjectItem[]) => void, setError: (value: string | null) => void, setLoading: (value: boolean) => void) {
  if (!projectId) { setItems([]); return; }
  setLoading(true);
  try { setItems(await fetchProjectActions(projectId)); setError(null); }
  catch (error: unknown) { setError(error instanceof Error ? error.message : "Failed to load project actions."); }
  finally { setLoading(false); }
}

function useProjectItemSelection(items: ProjectItem[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const selectedIndex = selectedItem ? items.findIndex((item) => item.id === selectedItem.id) : -1;
  return { items, selectedId, selectedItem, selectedIndex, setSelectedId, selectFirst: () => setSelectedId(items[0]?.id ?? null), selectLast: () => setSelectedId(items[items.length - 1]?.id ?? null), selectNext: () => moveSelection(items, selectedIndex, setSelectedId, 1), selectPrevious: () => moveSelection(items, selectedIndex, setSelectedId, -1) };
}

function moveSelection(items: ProjectItem[], index: number, setSelectedId: (id: string | null) => void, delta: number) {
  if (items.length === 0) return;
  setSelectedId(items[Math.min(items.length - 1, Math.max(0, index + delta))].id);
}

function useProjectDetailEditState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTitleError, setEditingTitleError] = useState<string | null>(null);
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);
  return { editingBodyId, editingId, editingTitle, editingTitleError, setEditingBodyId, setEditingId, setEditingTitle, setEditingTitleError, setVimMode, vimMode };
}

function clearTitleEdit(edit: ReturnType<typeof useProjectDetailEditState>) {
  edit.setEditingId(null); edit.setEditingTitle(""); edit.setEditingTitleError(null);
}

function clearBodyEdit(edit: ReturnType<typeof useProjectDetailEditState>) {
  edit.setEditingBodyId(null); edit.setVimMode(null);
}

export function useProjectDetailController(project: Project | null) {
  const query = useProjectActionsQuery(project?.id ?? null);
  const [draft, setDraft] = useState<ProjectItem | null>(null);
  const items = draft ? [...query.items, draft] : query.items;
  const selection = useProjectItemSelection(items);
  const edit = useProjectDetailEditState();
  const zone = useActiveZone();
  useProjectSelectionPruning(items, selection, edit);
  return buildProjectDetailController(project, query, selection, edit, zone, draft, setDraft);
}

function useProjectSelectionPruning(items: ProjectItem[], selection: ReturnType<typeof useProjectItemSelection>, edit: ReturnType<typeof useProjectDetailEditState>) {
  useEffect(() => { if (!selection.selectedId && items[0]) selection.setSelectedId(items[0].id); }, [items, selection.selectedId]);
  useEffect(() => { if (selection.selectedId && !items.some((item) => item.id === selection.selectedId)) selection.setSelectedId(items[0]?.id ?? null); }, [items, selection.selectedId]);
  useEffect(() => { if (edit.editingId && !items.some((item) => item.id === edit.editingId)) clearTitleEdit(edit); }, [edit.editingId, items]);
}

function buildProjectDetailController(project: Project | null, query: ReturnType<typeof useProjectActionsQuery>, selection: ReturnType<typeof useProjectItemSelection>, edit: ReturnType<typeof useProjectDetailEditState>, zone: ReturnType<typeof useActiveZone>, draft: ProjectItem | null, setDraft: (item: ProjectItem | null) => void) {
  return { activeZone: zone.activeZone, editingBodyId: edit.editingBodyId, editingId: edit.editingId, editingTitle: edit.editingTitle, editingTitleError: edit.editingTitleError, errorMessage: query.errorMessage, isLoading: query.isLoading, items: selection.items, project, selectedItem: selection.selectedItem, vimMode: edit.vimMode, setActiveZone: zone.setActiveZone, setEditingTitle: (value: string) => { edit.setEditingTitle(value); edit.setEditingTitleError(null); }, setVimMode: edit.setVimMode, reload: query.reload, selectFirst: selection.selectFirst, selectLast: selection.selectLast, selectNext: selection.selectNext, selectPrevious: selection.selectPrevious, setSelectedId: selection.setSelectedId, createNewStuff: () => createDraft(project, selection, edit, zone, setDraft), startTitleEdit: () => startTitleEdit(selection.selectedItem, edit), commitTitle: () => commitTitle(project, selection.selectedItem, edit, draft, setDraft, query.reload), cancelTitleEdit: () => clearTitleEdit(edit), startBodyEdit: () => startBodyEdit(selection.selectedItem, edit, zone), commitBody: (body: ItemBody) => commitBody(selection.selectedItem, edit, body, query.reload), autosaveBody: (body: ItemBody) => autosaveBody(selection.selectedItem, edit, body, query.reload), cancelBodyEdit: () => clearBodyEdit(edit), processSelectedStuff: (energy: number | null, minutes: number | null, contextIds: string[], deadline: string | null) => processSelectedStuff(selection.selectedItem, energy, minutes, contextIds, deadline, query.reload), processSelectedStuffToCalendar: (payload: CalendarConversionPayload) => processSelectedStuffToCalendar(selection.selectedItem, payload, query.reload) };
}

function createDraft(project: Project | null, selection: ReturnType<typeof useProjectItemSelection>, edit: ReturnType<typeof useProjectDetailEditState>, zone: ReturnType<typeof useActiveZone>, setDraft: (item: ProjectItem | null) => void) {
  if (!project) return;
  const item = draftProjectItem(project.id);
  setDraft(item); selection.setSelectedId(item.id); edit.setEditingId(item.id); edit.setEditingTitle(""); zone.setActiveZone("project-actions-list");
}

function startTitleEdit(item: ProjectItem | null, edit: ReturnType<typeof useProjectDetailEditState>) {
  if (!item) return;
  edit.setEditingId(item.id); edit.setEditingTitle(item.id === DRAFT_PROJECT_ITEM_ID ? "" : item.title); edit.setEditingTitleError(null);
}

async function commitTitle(project: Project | null, item: ProjectItem | null, edit: ReturnType<typeof useProjectDetailEditState>, draft: ProjectItem | null, setDraft: (item: ProjectItem | null) => void, reload: () => void) {
  if (!project || !item || edit.editingId !== item.id) return;
  const title = edit.editingTitle.trim();
  if (!title) { setDraft(null); clearTitleEdit(edit); return; }
  item.id === DRAFT_PROJECT_ITEM_ID ? await createProjectStuff(project.id, title) : await updateProjectItemTitle(item, title);
  if (draft?.id === DRAFT_PROJECT_ITEM_ID) setDraft(null);
  clearTitleEdit(edit); reload();
}

function startBodyEdit(item: ProjectItem | null, edit: ReturnType<typeof useProjectDetailEditState>, zone: ReturnType<typeof useActiveZone>) {
  if (!item || item.id === DRAFT_PROJECT_ITEM_ID) return;
  zone.setActiveZone("project-item-detail"); edit.setEditingBodyId(item.id);
}

async function commitBody(item: ProjectItem | null, edit: ReturnType<typeof useProjectDetailEditState>, body: ItemBody, reload: () => void) {
  if (!item || edit.editingBodyId !== item.id) return;
  if (!isSameBody(item.body, body)) await updateProjectItemBody(item, body);
  clearBodyEdit(edit); reload();
}

async function autosaveBody(item: ProjectItem | null, edit: ReturnType<typeof useProjectDetailEditState>, body: ItemBody, reload: () => void) {
  if (!item || edit.editingBodyId !== item.id || isSameBody(item.body, body)) return;
  await updateProjectItemBody(item, body); reload();
}

async function processSelectedStuff(item: ProjectItem | null, energy: number | null, minutes: number | null, contextIds: string[], deadline: string | null, reload: () => void) {
  if (item?.kind !== "STUFF") return;
  await processProjectStuff(item, energy, minutes, contextIds, deadline); reload();
}

async function processSelectedStuffToCalendar(item: ProjectItem | null, payload: CalendarConversionPayload, reload: () => void) {
  if (item?.kind !== "STUFF") return;
  await processProjectStuffToCalendar(item, payload); reload();
}

export type ProjectDetailController = ReturnType<typeof useProjectDetailController>;
