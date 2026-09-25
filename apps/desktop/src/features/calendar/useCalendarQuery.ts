import { useEffect, useState } from "react";
import { mutateSharedEntityOptimistically } from "../../lib/state/optimisticSharedEntity.ts";
import { useSharedCollectionState } from "../../lib/state/sharedEntityStore.ts";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import { useDomainRevalidation } from "../sync-status/domainChanges.ts";
import type { ItemBody } from "../inbox/types";
import {
  deleteCalendar,
  fetchDoneTodayCalendars,
  fetchTodayCalendars,
  fetchDoneCalendars,
  fetchDeletedCalendars,
  fetchWeekCalendars,
  markCalendarDone,
  markCalendarOnGoing,
  patchCalendar,
  resetCalendarStatus,
  recoverDeletedCalendar,
  updateCalendarBody,
  updateCalendarTitle
} from "./api";
import { formatCalendarDate, getMondayForOffset } from "./calendarDateUtils";
import { assignItemProject } from "../projects/api";
import {
  calendarListWithReplacement,
  calendarListWithoutItem,
  calendarTodayDoneListAfterDone
} from "./calendarWorkspaceState";
import type { Calendar, CalendarPatch } from "./types";
import { calendarLoadErrorMessage } from "./useCalendarTodayQuery";
import type { CalendarSubview } from "./calendarWorkspaceState";

type CalendarDataState = ReturnType<typeof useCalendarDataState>;
type CalendarMutationState = ReturnType<typeof useCalendarMutationState>;

function useCalendarDataState() {
  const [weekOffset, setWeekOffset] = useState(0);
  const collections = useCalendarCollections(weekOffset);
  const [isLoading, setIsLoading] = useState(!todayCollectionsLoaded(collections));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return {
    ...calendarCollectionState(collections),
    errorMessage, isLoading, reloadToken, weekOffset,
    setErrorMessage, setIsLoading, setReloadToken, setWeekOffset
  };
}

function useCalendarCollections(weekOffset: number) {
  return {
    due: useSharedCollectionState<Calendar>("calendar:today:due"),
    doneToday: useSharedCollectionState<Calendar>("calendar:today:done"),
    completed: useSharedCollectionState<Calendar>("calendar:completed"),
    deleted: useSharedCollectionState<Calendar>("calendar:deleted"),
    weekly: useSharedCollectionState<Calendar>(`calendar:weekly:${weekOffset}`)
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
  const [due, done] = await Promise.all([fetchTodayCalendars(), fetchDoneTodayCalendars()]);
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
  const week = await fetchWeekCalendars(formatCalendarDate(monday));
  if (!cancelled()) state.setWeeklyCalendars(week);
}

function useCalendarLoader(subview: CalendarSubview, state: CalendarDataState): void {
  useEffect(() => {
    let cancelled = false;
    void loadCalendarData(subview, state, () => cancelled);
    return () => { cancelled = true; };
  }, [subview, state.reloadToken, state.weekOffset]);
}

function removeCalendar(state: CalendarDataState, id: string): void {
  state.setDueCalendars((items) => calendarListWithoutItem(items, id));
  state.setDoneTodayCalendars((items) => calendarListWithoutItem(items, id));
  state.setCompletedCalendars((items) => calendarListWithoutItem(items, id));
  state.setDeletedCalendars((items) => calendarListWithoutItem(items, id));
  state.setWeeklyCalendars((items) => calendarListWithoutItem(items, id));
}

function replaceCalendar(state: CalendarDataState, updated: Calendar): void {
  state.setDueCalendars((items) => calendarListWithReplacement(items, updated));
  state.setDoneTodayCalendars((items) => calendarListWithReplacement(items, updated));
  state.setCompletedCalendars((items) => calendarListWithReplacement(items, updated));
  state.setDeletedCalendars((items) => calendarListWithReplacement(items, updated));
  state.setWeeklyCalendars((items) => calendarListWithReplacement(items, updated));
}

function appendDoneTodayCalendar(state: CalendarDataState, updated: Calendar): void {
  const today = formatCalendarDate(new Date());
  state.setDoneTodayCalendars((items) => calendarTodayDoneListAfterDone(items, updated, today));
}

async function mutateCalendarStatus(
  id: string,
  state: CalendarDataState,
  mutations: CalendarMutationState,
  poll: () => void,
  action: (id: string) => Promise<Calendar>
): Promise<void> {
  mutations.setIsUpdating(true);
  try {
    await action(id);
    state.setReloadToken((v) => v + 1);
    state.setErrorMessage(null);
    poll();
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function markCalendarDoneItem(
  id: string,
  state: CalendarDataState,
  mutations: CalendarMutationState,
  poll: () => void
): Promise<void> {
  mutations.setIsUpdating(true);
  try {
    const updated = await markCalendarDone(id);
    removeCalendar(state, id);
    appendDoneTodayCalendar(state, updated);
    state.setErrorMessage(null);
    poll();
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
    state.setErrorMessage(null);
    poll();
  } finally {
    mutations.setIsDeleting(false);
  }
}

async function updateCalendarItemSchedule(
  item: Calendar,
  patch: CalendarPatch,
  state: CalendarDataState,
  poll: () => void
): Promise<Calendar> {
  const updated = await mutateSharedEntityOptimistically(
    item,
    { ...item, ...patch },
    () => patchCalendar(item.id, patch)
  );
  state.setErrorMessage(null);
  poll();
  return updated;
}

async function updateCalendarItemBody(
  item: Calendar,
  body: ItemBody,
  state: CalendarDataState,
  poll: () => void
): Promise<Calendar> {
  const updated = await mutateSharedEntityOptimistically(
    item,
    { ...item, body },
    () => updateCalendarBody(item, body)
  );
  state.setErrorMessage(null);
  poll();
  return updated;
}

async function updateCalendarItemTitle(
  item: Calendar,
  title: string,
  state: CalendarDataState,
  poll: () => void
): Promise<Calendar> {
  const updated = await mutateSharedEntityOptimistically(
    item,
    { ...item, title },
    () => updateCalendarTitle(item, title)
  );
  state.setErrorMessage(null);
  poll();
  return updated;
}

function useCalendarMutations(
  state: CalendarDataState,
  mutations: CalendarMutationState
) {
  const { triggerSyncStatusPolling } = useSyncStatus();
  return {
    deleteItem: (id: string) => deleteCalendarItem(id, state, mutations, triggerSyncStatusPolling),
    markAsDone: (id: string) => markCalendarDoneItem(id, state, mutations, triggerSyncStatusPolling),
    markAsOnGoing: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, markCalendarOnGoing),
    restoreStatus: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, resetCalendarStatus),
    recoverDeleted: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, recoverDeletedCalendar),
    updateBody: (item: Calendar, body: ItemBody) => updateCalendarItemBody(item, body, state, triggerSyncStatusPolling),
    updateSchedule: (item: Calendar, patch: CalendarPatch) => updateCalendarItemSchedule(item, patch, state, triggerSyncStatusPolling),
    updateTitle: (item: Calendar, title: string) => updateCalendarItemTitle(item, title, state, triggerSyncStatusPolling),
    assignProject: (item: Calendar, projectId: string | null) => assignCalendarItemProject(item, projectId, state, triggerSyncStatusPolling)
  };
}

async function assignCalendarItemProject(
  item: Calendar,
  projectId: string | null,
  state: CalendarDataState,
  poll: () => void
): Promise<Calendar> {
  const optimistic: Calendar = { ...item, projectId };
  const updated = await mutateSharedEntityOptimistically(
    item,
    optimistic,
    async () => {
      const result = await assignItemProject(item.id, projectId);
      return { ...item, projectId: result.projectId ?? projectId, projectTitle: result.projectTitle ?? null };
    }
  );
  state.setErrorMessage(null);
  poll();
  return updated;
}

export function useCalendarQuery(subview: CalendarSubview) {
  const state = useCalendarDataState();
  const mutations = useCalendarMutationState();
  const reload = () => state.setReloadToken((value) => value + 1);
  const actions = useCalendarMutations(state, mutations);
  useCalendarLoader(subview, state);
  useDomainRevalidation(["items", "calendars", "body_document", "project_items"], reload);
  return calendarQueryResult(state, mutations, actions, reload);
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
