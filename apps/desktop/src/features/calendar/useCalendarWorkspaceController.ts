import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import { useUndoRedoHistory } from "../history/useUndoRedoHistory";
import type { ItemBody } from "../inbox/types";
import {
  resolveTodayWeeklyPanel,
  resolveWeeklyOffset
} from "./calendarDateUtils";
import {
  calendarSubviewTarget,
  calendarItemsForPanel,
  moveCalendarSelection,
  resolveWeeklyColumnShift,
  selectedCalendar,
  selectedCalendarIndex,
  type CalendarSubviewDirection,
  type ColumnShiftDirection,
  type CalendarPanel,
  type CalendarSubview,
  type WeeklyDayPanel
} from "./calendarWorkspaceState";
import type { Calendar, CalendarPatch } from "./types";
import { useCalendarQuery } from "./useCalendarQuery";

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
  const query = useCalendarQuery(view.activeSubview);
  const items = calendarItemsForPanel(
    query.dueCalendars,
    query.doneTodayCalendars,
    query.completedCalendars,
    query.deletedCalendars,
    query.weeklyCalendars,
    view.activePanel
  );
  const selection = useCalendarSelection(items);
  const edit = useCalendarEditState();
  const zone = useActiveZone();
  const history = useUndoRedoHistory<Calendar>();
  return { edit, query, selection, view, zone, history };
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

async function updateSelectedCalendarSchedule(model: CalendarModel, patch: CalendarPatch): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.selection.setSelectedId((await model.query.updateSchedule(item, patch)).id);
  clearCalendarEditing(model.edit);
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

async function deleteSelectedCalendarAction(model: CalendarModel): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item) return;
  
  await model.query.deleteItem(item.id);
  model.history.pushUndo({ type: "DELETE", payload: item });
  
  clearCalendarEditing(model.edit);
  model.zone.setActiveZone(calendarListZoneForPanel(model.view.activePanel));
}

async function undoCalendarAction(model: CalendarModel) {
  const action = model.history.popUndo();
  if (!action) return;

  if (action.type === "DELETE") {
    await model.query.recoverDeleted(action.payload.id);
    model.selection.setSelectedId(action.payload.id);
  } else {
    await model.query.deleteItem(action.payload.id);
  }
}

async function redoCalendarAction(model: CalendarModel) {
  const action = model.history.popRedo();
  if (!action) return;

  if (action.type === "RESTORE") {
    await model.query.deleteItem(action.payload.id);
  } else {
    await model.query.recoverDeleted(action.payload.id);
    model.selection.setSelectedId(action.payload.id);
  }
}

function calendarListZoneForPanel(panel: CalendarPanel): any {
  if (panel === "done-today") return "calendar-today-done-panel";
  if (panel === "completed") return "calendar-completed-panel";
  if (panel === "deleted") return "calendar-deleted-panel";
  if (panel === "mon") return "calendar-mon-panel";
  if (panel === "tue") return "calendar-tue-panel";
  if (panel === "wed") return "calendar-wed-panel";
  if (panel === "thu") return "calendar-thu-panel";
  if (panel === "fri") return "calendar-fri-panel";
  if (panel === "sat") return "calendar-sat-panel";
  if (panel === "sun") return "calendar-sun-panel";
  return "calendar-today-due-panel";
}

function focusCalendarPanel(model: CalendarModel, panel: CalendarPanel): void {
  model.view.setActivePanel(panel);
  clearCalendarEditing(model.edit);
  model.zone.setActiveZone(calendarListZoneForPanel(panel));
}

function resetCalendarWorkspace(model: CalendarModel): void {
  clearCalendarEditing(model.edit);
  model.view.setActiveSubview("today");
  focusCalendarPanel(model, "due");
}

function switchCalendarSubview(model: CalendarModel, direction: CalendarSubviewDirection): void {
  const target = calendarSubviewTarget(model.view.activeSubview, direction);
  model.view.setActiveSubview(target.subview);
  focusCalendarPanel(model, target.panel);
}

/** Shifts weekly column focus left/right, crossing week boundaries when needed (REQ-02..04). */
function moveCalendarColumn(model: CalendarModel, direction: ColumnShiftDirection): void {
  const dayPanels: WeeklyDayPanel[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const currentDay = dayPanels.includes(model.view.activePanel as WeeklyDayPanel)
    ? (model.view.activePanel as WeeklyDayPanel)
    : "mon";
  const result = resolveWeeklyColumnShift(currentDay, direction);
  if (result.kind === "boundary") {
    model.query.setWeekOffset((prev) => prev + result.weekOffsetDelta);
  }
  focusCalendarPanel(model, result.panel);
}

function moveCalendarWeek(model: CalendarModel, direction: "previous" | "next"): void {
  model.query.setWeekOffset((offset) => resolveWeeklyOffset(offset, direction));
}

function focusTodayCalendarWeek(model: CalendarModel): void {
  model.query.setWeekOffset(0);
  focusCalendarPanel(model, resolveTodayWeeklyPanel(new Date()));
}

function useCalendarWorkspaceActions(model: CalendarModel) {
  return {
    autosaveBody: (body: ItemBody) => autosaveCalendarBodyEdit(model, body),
    cancelBodyEdit: () => clearCalendarBodyEdit(model.edit),
    cancelTitleEdit: () => clearCalendarTitleEdit(model.edit),
    commitBody: (body: ItemBody) => commitCalendarBodyEdit(model, body),
    commitTitle: () => commitCalendarTitleEdit(model),
    deleteSelected: () => deleteSelectedCalendarAction(model),
    focusPanel: (panel: CalendarPanel) => focusCalendarPanel(model, panel),
    markAsDone: () => runSelectedCalendarMutation(model, model.query.markAsDone),
    markAsOnGoing: () => runSelectedCalendarMutation(model, model.query.markAsOnGoing),
    moveColumnLeft: () => moveCalendarColumn(model, "left"),
    moveColumnRight: () => moveCalendarColumn(model, "right"),
    moveWeekNext: () => moveCalendarWeek(model, "next"),
    moveWeekPrevious: () => moveCalendarWeek(model, "previous"),
    reload: model.query.reload,
    resetWorkspace: () => resetCalendarWorkspace(model),
    restoreSelected: () => runSelectedCalendarMutation(model, model.query.restoreStatus),
    recoverDeleted: () => runSelectedCalendarMutation(model, model.query.recoverDeleted),
    selectNext: model.selection.selectNext,
    selectPrevious: model.selection.selectPrevious,
    startBodyEdit: () => startCalendarBodyEdit(model),
    startTitleEdit: () => startCalendarTitleEdit(model),
    focusTodayWeek: () => focusTodayCalendarWeek(model),
    switchToNextSubview: () => switchCalendarSubview(model, "next"),
    switchToPreviousSubview: () => switchCalendarSubview(model, "previous"),
    updateSchedule: (patch: CalendarPatch) => updateSelectedCalendarSchedule(model, patch),
    undo: () => undoCalendarAction(model),
    redo: () => redoCalendarAction(model)
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
    completedCalendars: model.query.completedCalendars,
    deletedCalendars: model.query.deletedCalendars,
    weeklyCalendars: model.query.weeklyCalendars,
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
    vimMode: model.edit.vimMode,
    weekOffset: model.query.weekOffset
  };
}

export function useCalendarWorkspaceController() {
  const model = useCalendarWorkspaceModel();
  const actions = useCalendarWorkspaceActions(model);
  useCalendarPruning(model);
  return buildCalendarController(model, actions);
}

export type CalendarWorkspaceController = ReturnType<typeof useCalendarWorkspaceController>;
