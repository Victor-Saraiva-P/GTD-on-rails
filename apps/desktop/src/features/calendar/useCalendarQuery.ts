import { useEffect, useState } from "react";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
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
  const [dueCalendars, setDueCalendars] = useState<Calendar[]>([]);
  const [doneTodayCalendars, setDoneTodayCalendars] = useState<Calendar[]>([]);
  const [completedCalendars, setCompletedCalendars] = useState<Calendar[]>([]);
  const [deletedCalendars, setDeletedCalendars] = useState<Calendar[]>([]);
  const [weeklyCalendars, setWeeklyCalendars] = useState<Calendar[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  
  return {
    dueCalendars, doneTodayCalendars, completedCalendars, deletedCalendars, weeklyCalendars,
    errorMessage, isLoading, reloadToken, weekOffset,
    setDueCalendars, setDoneTodayCalendars, setCompletedCalendars, setDeletedCalendars, setWeeklyCalendars,
    setErrorMessage, setIsLoading, setReloadToken, setWeekOffset
  };
}

function useCalendarMutationState() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  return { isDeleting, isUpdating, setIsDeleting, setIsUpdating };
}



async function loadCalendarData(
  subview: CalendarSubview,
  state: CalendarDataState,
  cancelled: () => boolean
): Promise<void> {
  state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    if (subview === "today") {
      const [due, done] = await Promise.all([fetchTodayCalendars(), fetchDoneTodayCalendars()]);
      if (!cancelled()) {
        state.setDueCalendars(due);
        state.setDoneTodayCalendars(done);
      }
    } else if (subview === "completed") {
      const done = await fetchDoneCalendars();
      if (!cancelled()) state.setCompletedCalendars(done);
    } else if (subview === "deleted") {
      const deleted = await fetchDeletedCalendars();
      if (!cancelled()) state.setDeletedCalendars(deleted);
    } else if (subview === "weekly") {
      const monday = getMondayForOffset(state.weekOffset);
      const week = await fetchWeekCalendars(formatCalendarDate(monday));
      if (!cancelled()) state.setWeeklyCalendars(week);
    }
  } catch (error) {
    if (!cancelled()) state.setErrorMessage(calendarLoadErrorMessage(error));
  } finally {
    if (!cancelled()) state.setIsLoading(false);
  }
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
  mutations: CalendarMutationState,
  poll: () => void
): Promise<Calendar> {
  mutations.setIsUpdating(true);
  try {
    const updated = await patchCalendar(item.id, patch);
    replaceCalendar(state, updated);
    state.setErrorMessage(null);
    poll();
    return updated;
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function updateCalendarItemBody(
  item: Calendar,
  body: ItemBody,
  state: CalendarDataState,
  mutations: CalendarMutationState,
  poll: () => void
): Promise<Calendar> {
  mutations.setIsUpdating(true);
  try {
    const updated = await updateCalendarBody(item, body);
    replaceCalendar(state, updated);
    state.setErrorMessage(null);
    poll();
    return updated;
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function updateCalendarItemTitle(
  item: Calendar,
  title: string,
  state: CalendarDataState,
  mutations: CalendarMutationState,
  poll: () => void
): Promise<Calendar> {
  mutations.setIsUpdating(true);
  try {
    const updated = await updateCalendarTitle(item, title);
    replaceCalendar(state, updated);
    state.setErrorMessage(null);
    poll();
    return updated;
  } finally {
    mutations.setIsUpdating(false);
  }
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
    updateBody: (item: Calendar, body: ItemBody) => updateCalendarItemBody(item, body, state, mutations, triggerSyncStatusPolling),
    updateSchedule: (item: Calendar, patch: CalendarPatch) => updateCalendarItemSchedule(item, patch, state, mutations, triggerSyncStatusPolling),
    updateTitle: (item: Calendar, title: string) => updateCalendarItemTitle(item, title, state, mutations, triggerSyncStatusPolling)
  };
}

export function useCalendarQuery(subview: CalendarSubview) {
  const state = useCalendarDataState();
  const mutations = useCalendarMutationState();
  const reload = () => state.setReloadToken((value) => value + 1);
  const actions = useCalendarMutations(state, mutations);
  useCalendarLoader(subview, state);
  return {
    ...actions,
    dueCalendars: state.dueCalendars,
    doneTodayCalendars: state.doneTodayCalendars,
    completedCalendars: state.completedCalendars,
    deletedCalendars: state.deletedCalendars,
    weeklyCalendars: state.weeklyCalendars,
    errorMessage: state.errorMessage,
    isDeleting: mutations.isDeleting,
    isLoading: state.isLoading,
    isUpdating: mutations.isUpdating,
    reload,
    weekOffset: state.weekOffset,
    setWeekOffset: state.setWeekOffset
  };
}
