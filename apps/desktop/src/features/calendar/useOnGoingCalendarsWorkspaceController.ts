import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import type { ItemBody } from "../inbox/types";
import type { Calendar } from "./types";
import { useOnGoingCalendarsQuery } from "./useOnGoingCalendarsQuery";

type CalendarSelection = ReturnType<typeof useCalendarSelection>;
type CalendarEditState = ReturnType<typeof useCalendarEditState>;
type CalendarModel = {
  edit: CalendarEditState;
  query: ReturnType<typeof useOnGoingCalendarsQuery>;
  selection: CalendarSelection;
  zone: ReturnType<typeof useActiveZone>;
};

function selectedCalendar(items: Calendar[], selectedId: string | null): Calendar | null {
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

function selectedCalendarIndex(items: Calendar[], item: Calendar | null): number {
  return item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
}

function moveCalendarSelection(selection: CalendarSelection, offset: number) {
  if (selection.items.length === 0) return;
  const nextIndex = Math.min(Math.max(selection.selectedIndex + offset, 0), selection.items.length - 1);
  selection.setSelectedId(selection.items[nextIndex].id);
}

function useCalendarSelection(items: Calendar[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedCalendar(items, selectedId);
  const index = selectedCalendarIndex(items, selected);
  return { items, selectedId, selectedIndex: index, selectedItem: selected, setSelectedId };
}

function useCalendarEditState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);
  return { editingBodyId, editingId, editingTitle, setEditingBodyId, setEditingId, setEditingTitle, setVimMode, vimMode };
}

function clearCalendarEditing(edit: CalendarEditState) {
  edit.setEditingBodyId(null);
  edit.setEditingId(null);
  edit.setEditingTitle("");
  edit.setVimMode(null);
}

function pruneCalendarState(model: CalendarModel) {
  if (model.selection.items.length === 0) {
    model.selection.setSelectedId(null);
    clearCalendarEditing(model.edit);
    return;
  }
  if (!model.selection.selectedItem) model.selection.setSelectedId(model.selection.items[0].id);
}

function useCalendarPruning(model: CalendarModel) {
  useEffect(() => pruneCalendarState(model), [model.selection.items, model.selection.selectedId]);
}

function startTitleEdit(model: CalendarModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.edit.setEditingId(item.id);
  model.edit.setEditingTitle(item.title);
}

async function commitTitle(model: CalendarModel) {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingId !== item.id) return;
  const title = model.edit.editingTitle.trim();
  if (!title) { clearCalendarEditing(model.edit); return; }
  const updated = title === item.title ? item : await model.query.updateTitle(item, title);
  model.selection.setSelectedId(updated.id);
  clearCalendarEditing(model.edit);
}

async function commitBody(model: CalendarModel, body: ItemBody) {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id) return;
  const sameBody = item.body.text === body.text && JSON.stringify(item.body) === JSON.stringify(body);
  if (!sameBody) model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
  clearCalendarEditing(model.edit);
}

async function mutateSelected(model: CalendarModel, mutate: (id: string) => Promise<void>) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await mutate(item.id);
  clearCalendarEditing(model.edit);
  model.zone.setActiveZone("ongoing-calendars-list");
}

function calendarEditActions(model: CalendarModel) {
  return {
    autosaveBody: (body: ItemBody) => commitBody(model, body),
    cancelBodyEdit: () => clearCalendarEditing(model.edit),
    cancelTitleEdit: () => clearCalendarEditing(model.edit),
    commitBody: (body: ItemBody) => commitBody(model, body),
    commitTitle: () => commitTitle(model),
    setEditingTitle: model.edit.setEditingTitle,
    setVimMode: model.edit.setVimMode,
    startBodyEdit: () => model.edit.setEditingBodyId(model.selection.selectedItem?.id ?? null),
    startTitleEdit: () => startTitleEdit(model)
  };
}

function calendarMutationActions(model: CalendarModel) {
  return {
    deleteSelected: () => mutateSelected(model, model.query.deleteItem),
    markAsDone: () => mutateSelected(model, model.query.markAsDone),
    restoreSelected: () => mutateSelected(model, model.query.restoreStatus)
  };
}

function calendarSelectionActions(model: CalendarModel) {
  return {
    selectNext: () => moveCalendarSelection(model.selection, 1),
    selectPrevious: () => moveCalendarSelection(model.selection, -1),
    setSelectedId: model.selection.setSelectedId
  };
}

function calendarControllerActions(model: CalendarModel) {
  return {
    ...calendarEditActions(model),
    ...calendarMutationActions(model),
    ...calendarSelectionActions(model)
  };
}

function calendarControllerState(model: CalendarModel) {
  return {
    activeZone: model.zone.activeZone,
    editingBodyId: model.edit.editingBodyId,
    editingId: model.edit.editingId,
    editingTitle: model.edit.editingTitle,
    errorMessage: model.query.errorMessage,
    isDeleting: model.query.isDeleting,
    isLoading: model.query.isLoading,
    isUpdating: model.query.isUpdating,
    reload: model.query.reload,
    selectedIndex: model.selection.selectedIndex,
    selectedItem: model.selection.selectedItem,
    setActiveZone: model.zone.setActiveZone,
    stuffs: model.selection.items,
    vimMode: model.edit.vimMode
  };
}

function buildCalendarController(model: CalendarModel) {
  return {
    ...calendarControllerActions(model),
    ...calendarControllerState(model)
  };
}

/**
 * Composes on going calendar list, selection, and editing state.
 *
 * @example const controller = useOnGoingCalendarsWorkspaceController()
 */
export function useOnGoingCalendarsWorkspaceController() {
  const query = useOnGoingCalendarsQuery();
  const selection = useCalendarSelection(query.items);
  const edit = useCalendarEditState();
  const zone = useActiveZone();
  const model = { edit, query, selection, zone };
  useCalendarPruning(model);
  return buildCalendarController(model);
}

export type OnGoingCalendarsWorkspaceController = ReturnType<typeof useOnGoingCalendarsWorkspaceController>;
