import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import type { ItemBody } from "../inbox/types";
import {
  deleteCalendar,
  fetchDoneTodayCalendars,
  fetchTodayCalendars,
  markCalendarDone,
  markCalendarOnGoing,
  resetCalendarStatus,
  updateCalendarBody,
  updateCalendarTitle
} from "./api";
import type { Calendar } from "./types";

type CalendarTodayState = ReturnType<typeof useCalendarTodayState>;
type CalendarMutationState = ReturnType<typeof useCalendarMutationState>;

export function calendarLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return `Failed to load calendars (${error.status})`;
  if (error instanceof Error) return error.message;
  return "Failed to load calendars";
}

function useCalendarTodayState() {
  const [dueCalendars, setDueCalendars] = useState<Calendar[]>([]);
  const [doneTodayCalendars, setDoneTodayCalendars] = useState<Calendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return { dueCalendars, doneTodayCalendars, errorMessage, isLoading, reloadToken, setDueCalendars, setDoneTodayCalendars, setErrorMessage, setIsLoading, setReloadToken };
}

function useCalendarMutationState() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  return { isDeleting, isUpdating, setIsDeleting, setIsUpdating };
}

async function loadCalendarToday(
  state: CalendarTodayState,
  cancelled: () => boolean
): Promise<void> {
  state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    const [dueCalendars, doneTodayCalendars] = await Promise.all([fetchTodayCalendars(), fetchDoneTodayCalendars()]);
    if (!cancelled()) updateLoadedCalendars(state, dueCalendars, doneTodayCalendars);
  } catch (error) {
    if (!cancelled()) state.setErrorMessage(calendarLoadErrorMessage(error));
  } finally {
    if (!cancelled()) state.setIsLoading(false);
  }
}

function updateLoadedCalendars(
  state: CalendarTodayState,
  dueCalendars: Calendar[],
  doneTodayCalendars: Calendar[]
): void {
  state.setDueCalendars(dueCalendars);
  state.setDoneTodayCalendars(doneTodayCalendars);
}

function useCalendarTodayLoader(state: CalendarTodayState): void {
  useEffect(() => {
    let cancelled = false;
    void loadCalendarToday(state, () => cancelled);
    return () => { cancelled = true; };
  }, [state.reloadToken]);
}

function removeCalendar(state: CalendarTodayState, id: string): void {
  state.setDueCalendars((items) => items.filter((item) => item.id !== id));
  state.setDoneTodayCalendars((items) => items.filter((item) => item.id !== id));
}

function replaceCalendar(state: CalendarTodayState, updated: Calendar): void {
  const replace = (items: Calendar[]) => items.map((item) => item.id === updated.id ? updated : item);
  state.setDueCalendars(replace);
  state.setDoneTodayCalendars(replace);
}

async function mutateCalendarStatus(
  id: string,
  state: CalendarTodayState,
  mutations: CalendarMutationState,
  poll: () => void,
  action: (id: string) => Promise<Calendar>
): Promise<void> {
  mutations.setIsUpdating(true);
  try {
    await action(id);
    removeCalendar(state, id);
    completeCalendarMutation(state, poll);
  } finally {
    mutations.setIsUpdating(false);
  }
}

function completeCalendarMutation(state: CalendarTodayState, poll: () => void): void {
  state.setErrorMessage(null);
  poll();
}

async function deleteCalendarItem(
  id: string,
  state: CalendarTodayState,
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

async function updateCalendarItemBody(
  item: Calendar,
  body: ItemBody,
  state: CalendarTodayState,
  mutations: CalendarMutationState,
  poll: () => void
): Promise<Calendar> {
  mutations.setIsUpdating(true);
  try {
    const updated = await updateCalendarBody(item, body);
    replaceCalendar(state, updated);
    completeCalendarMutation(state, poll);
    return updated;
  } finally {
    mutations.setIsUpdating(false);
  }
}

async function updateCalendarItemTitle(
  item: Calendar,
  title: string,
  state: CalendarTodayState,
  mutations: CalendarMutationState,
  poll: () => void
): Promise<Calendar> {
  mutations.setIsUpdating(true);
  try {
    const updated = await updateCalendarTitle(item, title);
    replaceCalendar(state, updated);
    completeCalendarMutation(state, poll);
    return updated;
  } finally {
    mutations.setIsUpdating(false);
  }
}

function useCalendarMutations(
  state: CalendarTodayState,
  mutations: CalendarMutationState
) {
  const { triggerSyncStatusPolling } = useSyncStatus();
  return {
    deleteItem: (id: string) => deleteCalendarItem(id, state, mutations, triggerSyncStatusPolling),
    markAsDone: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, markCalendarDone),
    markAsOnGoing: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, markCalendarOnGoing),
    restoreStatus: (id: string) => mutateCalendarStatus(id, state, mutations, triggerSyncStatusPolling, resetCalendarStatus),
    updateBody: (item: Calendar, body: ItemBody) => updateCalendarItemBody(item, body, state, mutations, triggerSyncStatusPolling),
    updateTitle: (item: Calendar, title: string) => updateCalendarItemTitle(item, title, state, mutations, triggerSyncStatusPolling)
  };
}

/**
 * Loads Today calendar panels and exposes item mutations.
 *
 * @example const query = useCalendarTodayQuery()
 */
export function useCalendarTodayQuery() {
  const state = useCalendarTodayState();
  const mutations = useCalendarMutationState();
  const reload = () => state.setReloadToken((value) => value + 1);
  const actions = useCalendarMutations(state, mutations);
  useCalendarTodayLoader(state);
  return { ...actions, dueCalendars: state.dueCalendars, doneTodayCalendars: state.doneTodayCalendars, errorMessage: state.errorMessage, isDeleting: mutations.isDeleting, isLoading: state.isLoading, isUpdating: mutations.isUpdating, reload };
}
