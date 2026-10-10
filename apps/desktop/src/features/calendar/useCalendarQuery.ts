import { useEffect, useState } from "react";
import { useSharedCollectionState } from "../../lib/state/sharedEntityStore.ts";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import { useDomainRevalidation } from "../sync-status/domainChanges.ts";
import type { ItemBody } from "../inbox/types";
import {
  deleteCalendar,
  fetchDoneTodayCalendarEntries,
  fetchTodayCalendarEntries,
  fetchDoneCalendars,
  fetchDeletedCalendars,
  fetchWeekCalendarEntries,
  markCalendarDone,
  markCalendarOnGoing,
  patchCalendar,
  resetCalendarStatus
} from "./api";
import { formatCalendarDate, getMondayForOffset, millisecondsUntilNextCalendarDay } from "./calendarDateUtils";
import { assignItemProject } from "../projects/api";
import { calendarListWithoutItem } from "./calendarWorkspaceState";
import type { Calendar, CalendarEntry, CalendarPatch, CalendarWorkspaceItem } from "./types";
import { isNextActionCalendarEntry } from "./types.ts";
import { calendarLoadErrorMessage } from "./useCalendarTodayQuery";
import type { CalendarSubview } from "./calendarWorkspaceState";
import {
  markNextActionDone,
  markNextActionOnGoing,
  patchNextActionAttributes,
  resetNextActionStatus
} from "../next-actions/api.ts";
import { restoreStuff, updateStuffBody, updateStuffTitle } from "../inbox/api.ts";

type CalendarDataState = ReturnType<typeof useCalendarDataState>;
type CalendarMutationState = ReturnType<typeof useCalendarMutationState>;

function useCalendarDataState() {
  const [weekOffset, setWeekOffset] = useState(0);
  const localDate = formatCalendarDate(new Date());
  const collections = useCalendarCollections(weekOffset);
  const [isLoading, setIsLoading] = useState(!todayCollectionsLoaded(collections));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return {
    ...calendarCollectionState(collections),
    errorMessage, isLoading, localDate, reloadToken, weekOffset,
    setErrorMessage, setIsLoading, setReloadToken, setWeekOffset
  };
}

function useCalendarCollections(weekOffset: number) {
  return {
    due: useSharedCollectionState<CalendarEntry>("calendar:today:due"),
    doneToday: useSharedCollectionState<CalendarEntry>("calendar:today:done"),
    completed: useSharedCollectionState<Calendar>("calendar:completed"),
    deleted: useSharedCollectionState<Calendar>("calendar:deleted"),
    weekly: useSharedCollectionState<CalendarEntry>(`calendar:weekly:${weekOffset}`)
  };
}

function todayCollectionsLoaded(collections: ReturnType<typeof useCalendarCollections>): boolean {
  return collections.due.loaded && collections.doneToday.loaded;
}

function calendarCollectionState(collections: ReturnType<typeof useCalendarCollections>) {
  const { due, doneToday, completed, deleted, weekly } = collections;
  return {
    dueCalendars: due.items, doneTodayCalendars: doneToday.items,
    completedCalendars: completed.items, deletedCalendars: deleted.items,
    weeklyCalendars: weekly.items, dueLoaded: due.loaded, doneTodayLoaded: doneToday.loaded,
    completedLoaded: completed.loaded, deletedLoaded: deleted.loaded, weeklyLoaded: weekly.loaded,
    setDueCalendars: due.setItems, setDoneTodayCalendars: doneToday.setItems,
    setCompletedCalendars: completed.setItems, setDeletedCalendars: deleted.setItems,
    setWeeklyCalendars: weekly.setItems
  };
}

function useCalendarMutationState() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  return { isDeleting, isUpdating, setIsDeleting, setIsUpdating };
}



function hasCalendarSnapshot(state: CalendarDataState, subview: CalendarSubview): boolean {
  if (subview === "today") return state.dueLoaded && state.doneTodayLoaded;
  if (subview === "completed") return state.completedLoaded;
  if (subview === "deleted") return state.deletedLoaded;
  return state.weeklyLoaded;
}

async function loadCalendarData(
  subview: CalendarSubview,
  state: CalendarDataState,
  cancelled: () => boolean
): Promise<void> {
  if (!hasCalendarSnapshot(state, subview)) state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    await loadCalendarSubview(subview, state, cancelled);
  } catch (error) {
    if (!cancelled()) state.setErrorMessage(calendarLoadErrorMessage(error));
  } finally {
    if (!cancelled()) state.setIsLoading(false);
  }
}

async function loadCalendarSubview(
  subview: CalendarSubview,
  state: CalendarDataState,
  cancelled: () => boolean
): Promise<void> {
  if (subview === "today") return loadTodayCalendars(state, cancelled);
  if (subview === "completed") return loadCompletedCalendars(state, cancelled);
  if (subview === "deleted") return loadDeletedCalendars(state, cancelled);
  return loadWeeklyCalendars(state, cancelled);
}

async function loadTodayCalendars(state: CalendarDataState, cancelled: () => boolean): Promise<void> {
  const [due, done] = await Promise.all([
    fetchTodayCalendarEntries(state.localDate),
    fetchDoneTodayCalendarEntries(state.localDate)
  ]);
  if (cancelled()) return;
  state.setDueCalendars(due);
  state.setDoneTodayCalendars(done);
}

async function loadCompletedCalendars(state: CalendarDataState, cancelled: () => boolean): Promise<void> {
  const done = await fetchDoneCalendars();
  if (!cancelled()) state.setCompletedCalendars(done);
}

async function loadDeletedCalendars(state: CalendarDataState, cancelled: () => boolean): Promise<void> {
  const deleted = await fetchDeletedCalendars();
  if (!cancelled()) state.setDeletedCalendars(deleted);
}

async function loadWeeklyCalendars(state: CalendarDataState, cancelled: () => boolean): Promise<void> {
  const monday = getMondayForOffset(state.weekOffset);
  const week = await fetchWeekCalendarEntries(formatCalendarDate(monday));
  if (!cancelled()) state.setWeeklyCalendars(week);
}

function useCalendarLoader(subview: CalendarSubview, state: CalendarDataState): void {
  useEffect(() => {
    let cancelled = false;
    void loadCalendarData(subview, state, () => cancelled);
    return () => { cancelled = true; };
  }, [subview, state.localDate, state.reloadToken, state.weekOffset]);
}

function removeCalendar(state: CalendarDataState, id: string): void {
  state.setDueCalendars((items) => calendarListWithoutItem(items, id));
  state.setDoneTodayCalendars((items) => calendarListWithoutItem(items, id));
  state.setCompletedCalendars((items) => calendarListWithoutItem(items, id));
  state.setDeletedCalendars((items) => calendarListWithoutItem(items, id));
  state.setWeeklyCalendars((items) => calendarListWithoutItem(items, id));
}

function completeCalendarMutation(state: CalendarDataState, poll: () => void): void {
  state.setReloadToken((value) => value + 1);
  state.setErrorMessage(null);
  poll();
}

async function runWorkspaceStatusMutation(
  item: CalendarWorkspaceItem,
  state: CalendarDataState,
  mutations: CalendarMutationState,
  poll: () => void,
  calendarAction: (id: string) => Promise<unknown>,
  nextActionAction: (id: string) => Promise<unknown>
): Promise<void> {
  mutations.setIsUpdating(true);
  try {
    await (isNextActionCalendarEntry(item) ? nextActionAction(item.id) : calendarAction(item.id));
    completeCalendarMutation(state, poll);
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function deleteCalendarItem(
  id: string,
  state: CalendarDataState,
  mutations: CalendarMutationState,
  poll: () => void
): Promise<void> {
  mutations.setIsDeleting(true);
  try {
    await deleteCalendar(id);
    removeCalendar(state, id);
    completeCalendarMutation(state, poll);
  } finally {
    mutations.setIsDeleting(false);
  }
}

async function recoverCalendarWorkspaceItem(
  id: string,
  state: CalendarDataState,
  mutations: CalendarMutationState,
  poll: () => void
): Promise<void> {
  mutations.setIsUpdating(true);
  try {
    await restoreStuff(id);
    completeCalendarMutation(state, poll);
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function updateCalendarItemSchedule(
  item: CalendarWorkspaceItem,
  patch: CalendarPatch,
  state: CalendarDataState,
  poll: () => void
): Promise<CalendarWorkspaceItem> {
  if (isNextActionCalendarEntry(item)) throw new Error(`calendar item '${item.id}' cannot edit schedule; expected CALENDAR source`);
  await patchCalendar(item.id, patch);
  completeCalendarMutation(state, poll);
  return { ...item, ...patch };
}

async function updateProjectedDeadline(
  item: CalendarWorkspaceItem,
  deadline: string | null,
  state: CalendarDataState,
  poll: () => void
): Promise<CalendarWorkspaceItem> {
  if (!isNextActionCalendarEntry(item)) throw new Error(`calendar item '${item.id}' cannot edit deadline; expected NEXT_ACTION source`);
  await patchNextActionAttributes(item.id, deadline ? { deadline } : { clearDeadline: true });
  completeCalendarMutation(state, poll);
  return deadline ? { ...item, deadline } : item;
}

async function updateCalendarItemBody(
  item: CalendarWorkspaceItem,
  body: ItemBody,
  state: CalendarDataState,
  poll: () => void
): Promise<CalendarWorkspaceItem> {
  const updated = await updateStuffBody(item, body);
  completeCalendarMutation(state, poll);
  return { ...item, body: updated.body, title: updated.title };
}

async function updateCalendarItemTitle(
  item: CalendarWorkspaceItem,
  title: string,
  state: CalendarDataState,
  poll: () => void
): Promise<CalendarWorkspaceItem> {
  const updated = await updateStuffTitle(item, title);
  completeCalendarMutation(state, poll);
  return { ...item, body: updated.body, title: updated.title };
}

function useCalendarMutations(
  state: CalendarDataState,
  mutations: CalendarMutationState
) {
  const { triggerSyncStatusPolling: poll } = useSyncStatus();
  return {
    deleteItem: (id: string) => deleteCalendarItem(id, state, mutations, poll),
    markAsDone: (item: CalendarWorkspaceItem) => runWorkspaceStatusMutation(item, state, mutations, poll, markCalendarDone, markNextActionDone),
    markAsOnGoing: (item: CalendarWorkspaceItem) => runWorkspaceStatusMutation(item, state, mutations, poll, markCalendarOnGoing, markNextActionOnGoing),
    restoreStatus: (item: CalendarWorkspaceItem) => runWorkspaceStatusMutation(item, state, mutations, poll, resetCalendarStatus, resetNextActionStatus),
    recoverDeleted: (id: string) => recoverCalendarWorkspaceItem(id, state, mutations, poll),
    updateBody: (item: CalendarWorkspaceItem, body: ItemBody) => updateCalendarItemBody(item, body, state, poll),
    updateDeadline: (item: CalendarWorkspaceItem, deadline: string | null) => updateProjectedDeadline(item, deadline, state, poll),
    updateSchedule: (item: CalendarWorkspaceItem, patch: CalendarPatch) => updateCalendarItemSchedule(item, patch, state, poll),
    updateTitle: (item: CalendarWorkspaceItem, title: string) => updateCalendarItemTitle(item, title, state, poll),
    assignProject: (item: CalendarWorkspaceItem, projectId: string | null) => assignCalendarItemProject(item, projectId, state, poll)
  };
}

async function assignCalendarItemProject(
  item: CalendarWorkspaceItem,
  projectId: string | null,
  state: CalendarDataState,
  poll: () => void
): Promise<CalendarWorkspaceItem> {
  const result = await assignItemProject(item.id, projectId);
  completeCalendarMutation(state, poll);
  return { ...item, projectId: result.projectId ?? projectId, projectTitle: result.projectTitle ?? null };
}

export function useCalendarQuery(subview: CalendarSubview) {
  const state = useCalendarDataState();
  const mutations = useCalendarMutationState();
  const reload = () => state.setReloadToken((value) => value + 1);
  const actions = useCalendarMutations(state, mutations);
  useCalendarLoader(subview, state);
  useCalendarLocalDateRefresh(state.localDate, reload);
  useDomainRevalidation(["items", "calendars", "next_actions", "body_document", "project_items"], reload);
  return calendarQueryResult(state, mutations, actions, reload);
}

function useCalendarLocalDateRefresh(localDate: string, reload: () => void): void {
  useEffect(() => {
    const refreshAfterDateChange = () => {
      if (formatCalendarDate(new Date()) !== localDate) reload();
    };
    const timer = window.setTimeout(refreshAfterDateChange, millisecondsUntilNextCalendarDay() + 50);
    window.addEventListener("focus", refreshAfterDateChange);
    document.addEventListener("visibilitychange", refreshAfterDateChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshAfterDateChange);
      document.removeEventListener("visibilitychange", refreshAfterDateChange);
    };
  }, [localDate, reload]);
}

function calendarQueryResult(
  state: CalendarDataState,
  mutations: CalendarMutationState,
  actions: ReturnType<typeof useCalendarMutations>,
  reload: () => void
) {
  return {
    ...actions,
    dueCalendars: state.dueCalendars, doneTodayCalendars: state.doneTodayCalendars,
    completedCalendars: state.completedCalendars, deletedCalendars: state.deletedCalendars,
    weeklyCalendars: state.weeklyCalendars, errorMessage: state.errorMessage,
    isDeleting: mutations.isDeleting, isLoading: state.isLoading, isUpdating: mutations.isUpdating,
    reload, weekOffset: state.weekOffset, setWeekOffset: state.setWeekOffset
  };
}
