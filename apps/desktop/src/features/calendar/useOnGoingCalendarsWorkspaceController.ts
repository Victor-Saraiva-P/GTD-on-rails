import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import type { ItemBody } from "../inbox/types";
import { isSameBody } from "../inbox/types";
import type { Calendar } from "./types";
import { useCalendarTitleEditState } from "./calendarTitleEditState";
import { selectCalendarBoundary } from "./calendarWorkspaceState";
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
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);
  const selected = selectedCalendar(items, selectedId);
  const index = selectedCalendarIndex(items, selected);
  return { items, pendingSelectedId, selectedId, selectedIndex: index, selectedItem: selected, setPendingSelectedId, setSelectedId };
}

function useCalendarEditState() {
  const titleEdit = useCalendarTitleEditState();
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);
  return { ...titleEdit, editingBodyId, setEditingBodyId, setVimMode, vimMode };
}

function clearCalendarEditing(edit: CalendarEditState) {
  edit.setEditingBodyId(null);
  edit.setEditingId(null);
  edit.setEditingTitle("");
  edit.setEditingTitleError(null);
  edit.setVimMode(null);
}

function pruneCalendarState(model: CalendarModel) {
  if (model.selection.items.length === 0) {
    model.selection.setSelectedId(null);
    return;
  }
  if (!model.selection.selectedItem) model.selection.setSelectedId(model.selection.items[0].id);
}

function useCalendarPruning(model: CalendarModel) {
  useEffect(() => pruneCalendarState(model), [model.selection.items, model.selection.selectedId]);
}

function usePendingCalendarSelection(model: CalendarModel) {
  useEffect(() => {
    const id = model.selection.pendingSelectedId;
    if (!id || !model.selection.items.some((item) => item.id === id)) return;
    model.selection.setSelectedId(id);
    model.selection.setPendingSelectedId(null);
  }, [model.selection.items, model.selection.pendingSelectedId]);
}

function startTitleEdit(model: CalendarModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.edit.setEditingId(item.id);
  model.edit.setEditingTitle(item.title);
  model.edit.setEditingTitleError(null);
}

async function commitTitle(model: CalendarModel) {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingId !== item.id) return;
  const title = model.edit.editingTitle.trim();
  if (!title) { clearCalendarEditing(model.edit); return; }
  try {
    const updated = title === item.title ? item : await model.query.updateTitle(item, title);
    model.selection.setSelectedId(updated.id);
    clearCalendarEditing(model.edit);
  } catch (error: unknown) {
    model.edit.setEditingTitleError(calendarTitleErrorMessage(error));
    throw error;
  }
}

function calendarTitleErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Failed to save title.";
}

async function commitBody(model: CalendarModel, body: ItemBody) {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id) return;
  const sameBody = isSameBody(item.body, body);
  if (!sameBody) model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
  clearCalendarEditing(model.edit);
}

async function autosaveBody(model: CalendarModel, body: ItemBody) {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id || isSameBody(item.body, body)) return;
  model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
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
    autosaveBody: (body: ItemBody) => autosaveBody(model, body),
    cancelBodyEdit: () => clearCalendarEditing(model.edit),
    cancelTitleEdit: () => clearCalendarEditing(model.edit),
    commitBody: (body: ItemBody) => commitBody(model, body),
    commitTitle: () => commitTitle(model),
    setEditingTitle: (value: string) => {
      model.edit.setEditingTitle(value);
      model.edit.setEditingTitleError(null);
    },
    setVimMode: model.edit.setVimMode,
    startBodyEdit: (id?: string) => model.edit.setEditingBodyId(id ?? model.selection.selectedItem?.id ?? null),
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
    selectFirst: () => selectCalendarBoundary(model.selection, "first"),
    selectLast: () => selectCalendarBoundary(model.selection, "last"),
    selectNext: () => moveCalendarSelection(model.selection, 1),
    selectPrevious: () => moveCalendarSelection(model.selection, -1),
    selectAfterReload: (id: string) => {
      model.selection.setPendingSelectedId(id);
      model.query.reload();
    },
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
    editingTitleError: model.edit.editingTitleError,
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
  usePendingCalendarSelection(model);
  return buildCalendarController(model);
}

export type OnGoingCalendarsWorkspaceController = ReturnType<typeof useOnGoingCalendarsWorkspaceController>;
