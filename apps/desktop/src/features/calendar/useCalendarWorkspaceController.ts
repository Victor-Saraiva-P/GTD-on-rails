import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import type { ItemBody } from "../inbox/types";
import {
  calendarItemsForPanel,
  moveCalendarSelection,
  selectedCalendar,
  selectedCalendarIndex,
  type CalendarPanel,
  type CalendarSubview
} from "./calendarWorkspaceState";
import type { Calendar } from "./types";
import { useCalendarTodayQuery } from "./useCalendarTodayQuery";

type CalendarEditState = ReturnType<typeof useCalendarEditState>;
type CalendarModel = ReturnType<typeof useCalendarWorkspaceModel>;
type CalendarActions = ReturnType<typeof useCalendarWorkspaceActions>;

function useCalendarViewState() {
  const [activeSubview, setActiveSubview] = useState<CalendarSubview>("today");
  const [activePanel, setActivePanel] = useState<CalendarPanel>("due");
  return { activePanel, activeSubview, setActivePanel, setActiveSubview };
}

function useCalendarSelection(items: Calendar[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = selectedCalendar(items, selectedId);
  const selectedIndex = selectedCalendarIndex(items, selectedItem);
  const cursor = { items, selectedIndex, setSelectedId };
  return { items, selectedId, selectedIndex, selectedItem, setSelectedId, selectNext: () => moveCalendarSelection(cursor, 1), selectPrevious: () => moveCalendarSelection(cursor, -1) };
}

function useCalendarEditState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);
  return { editingBodyId, editingId, editingTitle, setEditingBodyId, setEditingId, setEditingTitle, setVimMode, vimMode };
}

function clearCalendarTitleEdit(edit: CalendarEditState): void {
  edit.setEditingId(null);
  edit.setEditingTitle("");
}

function clearCalendarBodyEdit(edit: CalendarEditState): void {
  edit.setEditingBodyId(null);
  edit.setVimMode(null);
}

function clearCalendarEditing(edit: CalendarEditState): void {
  clearCalendarTitleEdit(edit);
  clearCalendarBodyEdit(edit);
}

function hasVisibleCalendar(model: CalendarModel, id: string): boolean {
  return model.selection.items.some((item) => item.id === id);
}

function pruneCalendarState(model: CalendarModel): void {
  if (model.selection.items.length === 0) {
    model.selection.setSelectedId(null);
    clearCalendarEditing(model.edit);
    return;
  }
  pruneCalendarSelection(model);
  if (model.edit.editingId && !hasVisibleCalendar(model, model.edit.editingId)) clearCalendarTitleEdit(model.edit);
  if (model.edit.editingBodyId && !hasVisibleCalendar(model, model.edit.editingBodyId)) clearCalendarBodyEdit(model.edit);
}

function pruneCalendarSelection(model: CalendarModel): void {
  if (!model.selection.selectedId || !hasVisibleCalendar(model, model.selection.selectedId)) {
    model.selection.setSelectedId(model.selection.items[0].id);
  }
}

function useCalendarPruning(model: CalendarModel): void {
  useEffect(() => pruneCalendarState(model), [model.edit.editingBodyId, model.edit.editingId, model.selection.items, model.selection.selectedId]);
}

function useCalendarWorkspaceModel() {
  const view = useCalendarViewState();
  const query = useCalendarTodayQuery();
  const items = calendarItemsForPanel(query.dueCalendars, query.doneTodayCalendars, view.activePanel);
  const selection = useCalendarSelection(items);
  const edit = useCalendarEditState();
  const zone = useActiveZone();
  return { edit, query, selection, view, zone };
}

function startCalendarTitleEdit(model: CalendarModel): void {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.edit.setEditingId(item.id);
  model.edit.setEditingTitle(item.title);
}

async function commitCalendarTitleEdit(model: CalendarModel): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingId !== item.id) return;
  const title = model.edit.editingTitle.trim();
  if (!title) { clearCalendarTitleEdit(model.edit); return; }
  const updated = title === item.title ? item : await model.query.updateTitle(item, title);
  model.selection.setSelectedId(updated.id);
  clearCalendarTitleEdit(model.edit);
}

function startCalendarBodyEdit(model: CalendarModel): void {
  if (!model.selection.selectedItem) return;
  model.zone.setActiveZone("calendar-detail");
  model.edit.setEditingBodyId(model.selection.selectedItem.id);
}

function sameCalendarBody(item: Calendar, body: ItemBody): boolean {
  return item.body.text === body.text && JSON.stringify(item.body) === JSON.stringify(body);
}

async function commitCalendarBodyEdit(model: CalendarModel, body: ItemBody): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id) return;
  if (!sameCalendarBody(item, body)) model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
  clearCalendarBodyEdit(model.edit);
}

async function autosaveCalendarBodyEdit(model: CalendarModel, body: ItemBody): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id || sameCalendarBody(item, body)) return;
  model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
}

async function runSelectedCalendarMutation(
  model: CalendarModel,
  action: (id: string) => Promise<void>
): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item) return;
  await action(item.id);
  clearCalendarEditing(model.edit);
  model.zone.setActiveZone(calendarListZoneForPanel(model.view.activePanel));
}

function calendarListZoneForPanel(panel: CalendarPanel): "calendar-today-due-panel" | "calendar-today-done-panel" {
  return panel === "done-today" ? "calendar-today-done-panel" : "calendar-today-due-panel";
}

function focusCalendarPanel(model: CalendarModel, panel: CalendarPanel): void {
  model.view.setActivePanel(panel);
  clearCalendarEditing(model.edit);
  model.zone.setActiveZone(calendarListZoneForPanel(panel));
}

function resetCalendarWorkspace(model: CalendarModel): void {
  clearCalendarEditing(model.edit);
  focusCalendarPanel(model, "due");
}

function useCalendarWorkspaceActions(model: CalendarModel) {
  return {
    autosaveBody: (body: ItemBody) => autosaveCalendarBodyEdit(model, body),
    cancelBodyEdit: () => clearCalendarBodyEdit(model.edit),
    cancelTitleEdit: () => clearCalendarTitleEdit(model.edit),
    commitBody: (body: ItemBody) => commitCalendarBodyEdit(model, body),
    commitTitle: () => commitCalendarTitleEdit(model),
    deleteSelected: () => runSelectedCalendarMutation(model, model.query.deleteItem),
    focusPanel: (panel: CalendarPanel) => focusCalendarPanel(model, panel),
    markAsDone: () => runSelectedCalendarMutation(model, model.query.markAsDone),
    markAsOnGoing: () => runSelectedCalendarMutation(model, model.query.markAsOnGoing),
    reload: model.query.reload,
    resetWorkspace: () => resetCalendarWorkspace(model),
    restoreSelected: () => runSelectedCalendarMutation(model, model.query.restoreStatus),
    selectNext: model.selection.selectNext,
    selectPrevious: model.selection.selectPrevious,
    startBodyEdit: () => startCalendarBodyEdit(model),
    startTitleEdit: () => startCalendarTitleEdit(model)
  };
}

function buildCalendarController(model: CalendarModel, actions: CalendarActions) {
  return {
    ...actions,
    activePanel: model.view.activePanel,
    activeSubview: model.view.activeSubview,
    activeZone: model.zone.activeZone,
    dueCalendars: model.query.dueCalendars,
    doneTodayCalendars: model.query.doneTodayCalendars,
    editingBodyId: model.edit.editingBodyId,
    editingId: model.edit.editingId,
    editingTitle: model.edit.editingTitle,
    errorMessage: model.query.errorMessage,
    isDeleting: model.query.isDeleting,
    isLoading: model.query.isLoading,
    isUpdating: model.query.isUpdating,
    selectedIndex: model.selection.selectedIndex,
    selectedItem: model.selection.selectedItem,
    setActiveSubview: model.view.setActiveSubview,
    setActiveZone: model.zone.setActiveZone,
    setEditingTitle: model.edit.setEditingTitle,
    setSelectedId: model.selection.setSelectedId,
    setVimMode: model.edit.setVimMode,
    stuffs: model.selection.items,
    vimMode: model.edit.vimMode
  };
}

/**
 * Composes calendar panels, selection, editing, and keybind state.
 *
 * @example const controller = useCalendarWorkspaceController()
 */
export function useCalendarWorkspaceController() {
  const model = useCalendarWorkspaceModel();
  const actions = useCalendarWorkspaceActions(model);
  useCalendarPruning(model);
  return buildCalendarController(model, actions);
}

export type CalendarWorkspaceController = ReturnType<typeof useCalendarWorkspaceController>;
