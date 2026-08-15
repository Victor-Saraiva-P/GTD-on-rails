import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import { useUndoRedoHistory } from "../history/useUndoRedoHistory";
import type { FocusZoneId } from "../keybinds/types";
import type { ItemBody } from "../inbox/types";
import { isSameBody } from "../inbox/types";
import {
  resolveTodayWeeklyPanel,
  resolveWeeklyOffset
} from "./calendarDateUtils";
import {
  clearCalendarTitleEdit,
  useCalendarTitleEditState
} from "./calendarTitleEditState";
import {
  calendarSubviewTarget,
  calendarItemsForPanel,
  moveCalendarSelection,
  resolveWeeklyColumnShift,
  selectCalendarBoundary,
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
import {
  moveRecurringCalendarTemplateSelection,
  selectRecurringCalendarTemplateBoundary,
  selectedRecurringCalendarTemplate,
  selectedRecurringCalendarTemplateIndex
} from "../recurring-calendar-templates/recurringCalendarTemplateSelection";
import type {
  RecurringCalendarTemplate,
  RecurringCalendarTemplateConversionPayload
} from "../recurring-calendar-templates/types";

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
  return {
    items,
    selectedId,
    selectedIndex,
    selectedItem,
    setSelectedId,
    selectFirst: () => selectCalendarBoundary(cursor, "first"),
    selectLast: () => selectCalendarBoundary(cursor, "last"),
    selectNext: () => moveCalendarSelection(cursor, 1),
    selectPrevious: () => moveCalendarSelection(cursor, -1)
  };
}

function useRecurringCalendarTemplateSelection(templates: RecurringCalendarTemplate[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = selectedRecurringCalendarTemplate(templates, selectedId);
  const selectedIndex = selectedRecurringCalendarTemplateIndex(templates, selectedItem);
  const cursor = { templates, selectedIndex, setSelectedId };
  return {
    selectedId,
    selectedIndex,
    selectedItem,
    setSelectedId,
    selectFirst: () => selectRecurringCalendarTemplateBoundary(cursor, "first"),
    selectLast: () => selectRecurringCalendarTemplateBoundary(cursor, "last"),
    selectNext: () => moveRecurringCalendarTemplateSelection(cursor, 1),
    selectPrevious: () => moveRecurringCalendarTemplateSelection(cursor, -1)
  };
}

function useCalendarEditState() {
  const titleEdit = useCalendarTitleEditState();
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [recurringEditingBodyId, setRecurringEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);
  return { ...titleEdit, editingBodyId, recurringEditingBodyId, setEditingBodyId, setRecurringEditingBodyId, setVimMode, vimMode };
}

function clearCalendarBodyEdit(edit: CalendarEditState): void {
  edit.setEditingBodyId(null);
  edit.setVimMode(null);
}

function clearRecurringTemplateBodyEdit(edit: CalendarEditState): void {
  edit.setRecurringEditingBodyId(null);
  edit.setVimMode(null);
}

function clearCalendarEditing(edit: CalendarEditState): void {
  clearCalendarTitleEdit(edit);
  clearCalendarBodyEdit(edit);
  clearRecurringTemplateBodyEdit(edit);
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

function pruneRecurringCalendarTemplateSelection(model: CalendarModel): void {
  const templates = model.query.recurringCalendarTemplates;
  if (templates.length === 0) {
    model.recurringSelection.setSelectedId(null);
    clearRecurringTemplateBodyEdit(model.edit);
    return;
  }
  const visible = templates.some((template) => template.id === model.recurringSelection.selectedId);
  if (!visible) model.recurringSelection.setSelectedId(templates[0].id);
  const editing = model.edit.recurringEditingBodyId;
  if (editing && !templates.some((template) => template.id === editing)) clearRecurringTemplateBodyEdit(model.edit);
}

function useCalendarPruning(model: CalendarModel): void {
  useEffect(() => pruneCalendarState(model), [model.edit.editingBodyId, model.edit.editingId, model.selection.items, model.selection.selectedId]);
  useEffect(() => pruneRecurringCalendarTemplateSelection(model), [model.edit.recurringEditingBodyId, model.query.recurringCalendarTemplates, model.recurringSelection.selectedId]);
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
  const recurringSelection = useRecurringCalendarTemplateSelection(query.recurringCalendarTemplates);
  const edit = useCalendarEditState();
  const zone = useActiveZone();
  const history = useUndoRedoHistory<Calendar>();
  const recurringHistory = useUndoRedoHistory<RecurringCalendarTemplate>();
  return { edit, query, recurringSelection, selection, view, zone, history, recurringHistory };
}

function startCalendarTitleEdit(model: CalendarModel): void {
  if (model.view.activeSubview === "recurring") {
    const template = model.recurringSelection.selectedItem;
    if (!template) return;
    model.edit.setEditingId(template.id);
    model.edit.setEditingTitle(template.title);
    model.edit.setEditingTitleError(null);
    return;
  }
  const item = model.selection.selectedItem;
  if (!item) return;
  model.edit.setEditingId(item.id);
  model.edit.setEditingTitle(item.title);
  model.edit.setEditingTitleError(null);
}

async function commitCalendarTitleEdit(model: CalendarModel): Promise<void> {
  if (model.view.activeSubview === "recurring") {
    return commitRecurringTemplateTitleEdit(model);
  }
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingId !== item.id) return;
  const title = model.edit.editingTitle.trim();
  if (!title) { clearCalendarTitleEdit(model.edit); return; }
  try {
    const updated = title === item.title ? item : await model.query.updateTitle(item, title);
    model.selection.setSelectedId(updated.id);
    clearCalendarTitleEdit(model.edit);
  } catch (error: unknown) {
    model.edit.setEditingTitleError(calendarTitleErrorMessage(error));
    throw error;
  }
}

async function commitRecurringTemplateTitleEdit(model: CalendarModel): Promise<void> {
  const template = model.recurringSelection.selectedItem;
  if (!template || model.edit.editingId !== template.id) return;
  const title = model.edit.editingTitle.trim();
  if (!title) { clearCalendarTitleEdit(model.edit); return; }
  try {
    if (title !== template.title) {
      const updated = await model.query.updateRecurringTemplate(template, {
        title,
        startDate: template.startDate,
        scheduledTime: template.scheduledTime,
        intervalValue: template.intervalValue,
        recurrenceUnit: template.recurrenceUnit,
        weeklyWeekdays: template.weeklyWeekdays,
        endDate: template.endDate
      });
      model.recurringSelection.setSelectedId(updated.id);
    }
    clearCalendarTitleEdit(model.edit);
  } catch (error: unknown) {
    model.edit.setEditingTitleError(calendarTitleErrorMessage(error));
    throw error;
  }
}

function calendarTitleErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Failed to save title.";
}

function startCalendarBodyEdit(model: CalendarModel): void {
  if (!model.selection.selectedItem) return;
  model.zone.setActiveZone("calendar-detail");
  model.edit.setEditingBodyId(model.selection.selectedItem.id);
}

function startRecurringTemplateBodyEdit(model: CalendarModel): void {
  const template = model.recurringSelection.selectedItem;
  if (!template) return;
  model.zone.setActiveZone("calendar-detail");
  model.edit.setRecurringEditingBodyId(template.id);
}

async function commitCalendarBodyEdit(model: CalendarModel, body: ItemBody): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id) return;
  if (!isSameBody(item.body, body)) model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
  clearCalendarBodyEdit(model.edit);
}

async function autosaveCalendarBodyEdit(model: CalendarModel, body: ItemBody): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id || isSameBody(item.body, body)) return;
  model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
}

async function commitRecurringTemplateBodyEdit(model: CalendarModel, body: ItemBody): Promise<void> {
  const template = model.recurringSelection.selectedItem;
  if (!template || model.edit.recurringEditingBodyId !== template.id) return;
  if (!isSameBody(template.body, body)) model.recurringSelection.setSelectedId((await model.query.updateRecurringTemplateBody(template, body)).id);
  clearRecurringTemplateBodyEdit(model.edit);
}

async function autosaveRecurringTemplateBodyEdit(model: CalendarModel, body: ItemBody): Promise<void> {
  const template = model.recurringSelection.selectedItem;
  if (!template || model.edit.recurringEditingBodyId !== template.id || isSameBody(template.body, body)) return;
  model.recurringSelection.setSelectedId((await model.query.updateRecurringTemplateBody(template, body)).id);
}

async function updateSelectedCalendarSchedule(model: CalendarModel, patch: CalendarPatch): Promise<void> {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.selection.setSelectedId((await model.query.updateSchedule(item, patch)).id);
  clearCalendarEditing(model.edit);
}

async function updateRecurringTemplateScheduleAction(
  model: CalendarModel,
  patch: RecurringCalendarTemplateConversionPayload
): Promise<void> {
  const template = model.recurringSelection.selectedItem;
  if (!template) return;
  const updated = await model.query.updateRecurringTemplate(template, {
    ...patch,
    title: template.title
  });
  model.recurringSelection.setSelectedId(updated.id);
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

async function deleteSelectedRecurringTemplateAction(model: CalendarModel): Promise<void> {
  const template = model.recurringSelection.selectedItem;
  if (!template) return;
  await model.query.deleteRecurringTemplate(template.id);
  model.recurringHistory.pushUndo({ type: "DELETE", payload: template });
  clearRecurringTemplateBodyEdit(model.edit);
  model.zone.setActiveZone("calendar-recurring-panel");
}

async function undoCalendarAction(model: CalendarModel) {
  if (model.view.activeSubview === "recurring") {
    return undoRecurringTemplateAction(model);
  }
  const action = model.history.popUndo();
  if (!action) return;
  if (action.type === "DELETE") {
    await model.query.recoverDeleted(action.payload.id);
    model.selection.setSelectedId(action.payload.id);
  } else {
    await model.query.deleteItem(action.payload.id);
  }
}

async function undoRecurringTemplateAction(model: CalendarModel) {
  const action = model.recurringHistory.popUndo();
  if (!action) return;
  if (action.type === "DELETE") {
    const restored = await model.query.restoreRecurringTemplate(action.payload.id);
    model.recurringSelection.setSelectedId(restored.id);
  } else {
    await model.query.deleteRecurringTemplate(action.payload.id);
  }
}

async function redoCalendarAction(model: CalendarModel) {
  if (model.view.activeSubview === "recurring") {
    return redoRecurringTemplateAction(model);
  }
  const action = model.history.popRedo();
  if (!action) return;
  if (action.type === "RESTORE") {
    await model.query.deleteItem(action.payload.id);
  } else {
    await model.query.recoverDeleted(action.payload.id);
    model.selection.setSelectedId(action.payload.id);
  }
}

async function redoRecurringTemplateAction(model: CalendarModel) {
  const action = model.recurringHistory.popRedo();
  if (!action) return;
  if (action.type === "RESTORE") {
    await model.query.deleteRecurringTemplate(action.payload.id);
  } else {
    const restored = await model.query.restoreRecurringTemplate(action.payload.id);
    model.recurringSelection.setSelectedId(restored.id);
  }
}

function calendarListZoneForPanel(panel: CalendarPanel): FocusZoneId {
  if (panel === "done-today") return "calendar-today-done-panel";
  if (panel === "recurring") return "calendar-recurring-panel";
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
    autosaveRecurringTemplateBody: (body: ItemBody) => autosaveRecurringTemplateBodyEdit(model, body),
    cancelBodyEdit: () => clearCalendarBodyEdit(model.edit),
    cancelRecurringTemplateBodyEdit: () => clearRecurringTemplateBodyEdit(model.edit),
    cancelTitleEdit: () => clearCalendarTitleEdit(model.edit),
    commitBody: (body: ItemBody) => commitCalendarBodyEdit(model, body),
    commitRecurringTemplateBody: (body: ItemBody) => commitRecurringTemplateBodyEdit(model, body),
    commitTitle: () => commitCalendarTitleEdit(model),
    deleteSelected: () => deleteSelectedCalendarAction(model),
    deleteSelectedRecurringTemplate: () => deleteSelectedRecurringTemplateAction(model),
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
    selectFirst: model.selection.selectFirst,
    selectFirstRecurringTemplate: model.recurringSelection.selectFirst,
    selectLast: model.selection.selectLast,
    selectLastRecurringTemplate: model.recurringSelection.selectLast,
    selectNext: model.selection.selectNext,
    selectNextRecurringTemplate: model.recurringSelection.selectNext,
    selectPrevious: model.selection.selectPrevious,
    selectPreviousRecurringTemplate: model.recurringSelection.selectPrevious,
    startBodyEdit: () => startCalendarBodyEdit(model),
    startRecurringTemplateBodyEdit: () => startRecurringTemplateBodyEdit(model),
    startTitleEdit: () => startCalendarTitleEdit(model),
    focusTodayWeek: () => focusTodayCalendarWeek(model),
    switchToNextSubview: () => switchCalendarSubview(model, "next"),
    switchToPreviousSubview: () => switchCalendarSubview(model, "previous"),
    updateSchedule: (patch: CalendarPatch) => updateSelectedCalendarSchedule(model, patch),
    updateRecurringTemplateSchedule: (patch: RecurringCalendarTemplateConversionPayload) => updateRecurringTemplateScheduleAction(model, patch),
    undo: () => undoCalendarAction(model),
    redo: () => redoCalendarAction(model),
    undoRecurringTemplate: () => undoRecurringTemplateAction(model),
    redoRecurringTemplate: () => redoRecurringTemplateAction(model)
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
    recurringCalendarTemplates: model.query.recurringCalendarTemplates,
    recurringEditingBodyId: model.edit.recurringEditingBodyId,
    weeklyCalendars: model.query.weeklyCalendars,
    editingBodyId: model.edit.editingBodyId,
    editingId: model.edit.editingId,
    editingTitle: model.edit.editingTitle,
    editingTitleError: model.edit.editingTitleError,
    errorMessage: model.query.errorMessage,
    isDeleting: model.query.isDeleting,
    isLoading: model.query.isLoading,
    isUpdating: model.query.isUpdating,
    selectedIndex: model.selection.selectedIndex,
    selectedItem: model.selection.selectedItem,
    selectedRecurringTemplate: model.recurringSelection.selectedItem,
    selectedRecurringTemplateIndex: model.recurringSelection.selectedIndex,
    setSelectedRecurringTemplateId: model.recurringSelection.setSelectedId,
    setActiveSubview: model.view.setActiveSubview,
    setActiveZone: model.zone.setActiveZone,
    setEditingTitle: (value: string) => {
      model.edit.setEditingTitle(value);
      model.edit.setEditingTitleError(null);
    },
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
