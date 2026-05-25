import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api/apiClient";
import { useSyncStatus } from "../sync-status/SyncStatusProvider";
import type { ItemBody } from "../inbox/types";
import {
  deleteCalendar,
  fetchOnGoingCalendars,
  markCalendarDone,
  resetCalendarStatus,
  updateCalendarBody,
  updateCalendarTitle
} from "./api";
import type { Calendar } from "./types";

type CalendarLoadState = ReturnType<typeof useCalendarLoadState>;
type CalendarMutationState = ReturnType<typeof useCalendarMutationState>;

function calendarErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return `Failed to load calendars (${error.status})`;
  if (error instanceof Error) return error.message;
  return "Failed to load calendars";
}

function useCalendarLoadState() {
  const [items, setItems] = useState<Calendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  return { errorMessage, isLoading, items, reloadToken, setErrorMessage, setIsLoading, setItems, setReloadToken };
}

function useCalendarMutationState() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  return { isDeleting, isUpdating, setIsDeleting, setIsUpdating };
}

async function loadOnGoingCalendars(state: CalendarLoadState, cancelled: () => boolean) {
  state.setIsLoading(true);
  state.setErrorMessage(null);
  try {
    const calendars = await fetchOnGoingCalendars();
    if (!cancelled()) state.setItems(calendars);
  } catch (error) {
    if (!cancelled()) state.setErrorMessage(calendarErrorMessage(error));
  } finally {
    if (!cancelled()) state.setIsLoading(false);
  }
}

function useOnGoingCalendarsLoader(state: CalendarLoadState) {
  useEffect(() => {
    let cancelled = false;
    void loadOnGoingCalendars(state, () => cancelled);
    return () => { cancelled = true; };
  }, [state.reloadToken]);
}

function completeCalendarMutation(state: CalendarLoadState, poll: () => void) {
  state.setErrorMessage(null);
  poll();
}

function replaceCalendar(items: Calendar[], updated: Calendar): Calendar[] {
  return items.map((item) => (item.id === updated.id ? updated : item));
}

function useOnGoingCalendarMutations(
  state: CalendarLoadState,
  mutations: CalendarMutationState
) {
  const { triggerSyncStatusPolling } = useSyncStatus();
  return {
    deleteItem: (id: string) => deleteCalendarItem(id, state, mutations, triggerSyncStatusPolling),
    markAsDone: (id: string) => markOnGoingCalendarDone(id, state, mutations, triggerSyncStatusPolling),
    restoreStatus: (id: string) => restoreOnGoingCalendar(id, state, mutations, triggerSyncStatusPolling),
    updateBody: (item: Calendar, body: ItemBody) => updateBody(item, body, state, mutations, triggerSyncStatusPolling),
    updateTitle: (item: Calendar, title: string) => updateTitle(item, title, state, mutations, triggerSyncStatusPolling)
  };
}

async function markOnGoingCalendarDone(
  id: string,
  state: CalendarLoadState,
  mutations: CalendarMutationState,
  poll: () => void
) {
  mutations.setIsUpdating(true);
  try { await markCalendarDone(id); state.setItems((items) => items.filter((item) => item.id !== id)); completeCalendarMutation(state, poll); }
  finally { mutations.setIsUpdating(false); }
}

async function restoreOnGoingCalendar(
  id: string,
  state: CalendarLoadState,
  mutations: CalendarMutationState,
  poll: () => void
) {
  mutations.setIsUpdating(true);
  try { await resetCalendarStatus(id); state.setItems((items) => items.filter((item) => item.id !== id)); completeCalendarMutation(state, poll); }
  finally { mutations.setIsUpdating(false); }
}

async function deleteCalendarItem(
  id: string,
  state: CalendarLoadState,
  mutations: CalendarMutationState,
  poll: () => void
) {
  mutations.setIsDeleting(true);
  try { await deleteCalendar(id); state.setItems((items) => items.filter((item) => item.id !== id)); completeCalendarMutation(state, poll); }
  finally { mutations.setIsDeleting(false); }
}

async function updateBody(
  item: Calendar,
  body: ItemBody,
  state: CalendarLoadState,
  mutations: CalendarMutationState,
  poll: () => void
) {
  mutations.setIsUpdating(true);
  try { const updated = await updateCalendarBody(item, body); state.setItems((items) => replaceCalendar(items, updated)); completeCalendarMutation(state, poll); return updated; }
  finally { mutations.setIsUpdating(false); }
}

async function updateTitle(
  item: Calendar,
  title: string,
  state: CalendarLoadState,
  mutations: CalendarMutationState,
  poll: () => void
) {
  mutations.setIsUpdating(true);
  try { const updated = await updateCalendarTitle(item, title); state.setItems((items) => replaceCalendar(items, updated)); completeCalendarMutation(state, poll); return updated; }
  finally { mutations.setIsUpdating(false); }
}

/**
 * Loads on going calendars and exposes item mutations.
 *
 * @example const query = useOnGoingCalendarsQuery()
 */
export function useOnGoingCalendarsQuery() {
  const state = useCalendarLoadState();
  const mutations = useCalendarMutationState();
  const reload = () => state.setReloadToken((value) => value + 1);
  const actions = useOnGoingCalendarMutations(state, mutations);
  useOnGoingCalendarsLoader(state);
  return { ...actions, errorMessage: state.errorMessage, isDeleting: mutations.isDeleting, isLoading: state.isLoading, isUpdating: mutations.isUpdating, items: state.items, reload };
}
