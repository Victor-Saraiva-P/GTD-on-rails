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
  restoreCalendarStatus,
  recoverDeletedCalendar,
  updateCalendarBody,
  updateCalendarTitle
} from "./api";
import type { Calendar } from "./types";
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  
  return {
    dueCalendars, doneTodayCalendars, completedCalendars, deletedCalendars, weeklyCalendars,
    errorMessage, isLoading, reloadToken,
    setDueCalendars, setDoneTodayCalendars, setCompletedCalendars, setDeletedCalendars, setWeeklyCalendars,
    setErrorMessage, setIsLoading, setReloadToken
  };
}

function useCalendarMutationState() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  return { isDeleting, isUpdating, setIsDeleting, setIsUpdating };
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      const monday = getMonday(new Date());
      const week = await fetchWeekCalendars(formatDate(monday));
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
  }, [subview, state.reloadToken]);
}

function removeCalendar(state: CalendarDataState, id: string): void {
  state.setDueCalendars((items) => items.filter((item) => item.id !== id));
  state.setDoneTodayCalendars((items) => items.filter((item) => item.id !== id));
  state.setCompletedCalendars((items) => items.filter((item) => item.id !== id));
  state.setDeletedCalendars((items) => items.filter((item) => item.id !== id));
  state.setWeeklyCalendars((items) => items.filter((item) => item.id !== id));
}

function replaceCalendar(state: CalendarDataState, updated: Calendar): void {
  const replace = (items: Calendar[]) => items.map((item) => item.id === updated.id ? updated : item);
  state.setDueCalendars(replace);
  state.setDoneTodayCalendars(replace);
  state.setCompletedCalendars(replace);
  state.setDeletedCalendars(replace);
  state.setWeeklyCalendars(replace);
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
    removeCalendar(state, id);
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
    markAsDone: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, markCalendarDone),
    markAsOnGoing: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, markCalendarOnGoing),
    restoreStatus: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, restoreCalendarStatus),
    recoverDeleted: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, recoverDeletedCalendar),
    updateBody: (item: Calendar, body: ItemBody) => updateCalendarItemBody(item, body, state, mutations, triggerSyncStatusPolling),
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
    reload
  };
}
