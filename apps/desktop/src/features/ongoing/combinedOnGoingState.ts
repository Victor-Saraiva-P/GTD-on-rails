import type { Calendar } from "../calendar/types";
import type { FocusZoneId } from "../keybinds/types";
import type { NextAction } from "../next-actions/types";

export type OnGoingPanelId = "next-actions" | "calendars";

export type OnGoingSelectionState = {
  activePanel: OnGoingPanelId;
  selectedCalendarId: string | null;
  selectedNextActionId: string | null;
};

export type OnGoingItemSelection =
  | { item: NextAction; type: "next-action" }
  | { item: Calendar; type: "calendar" };

export type OnGoingActionKind = "delete" | "done" | "restore";

export function activeOnGoingSelection(
  panel: OnGoingPanelId,
  nextAction: NextAction | null,
  calendar: Calendar | null
): OnGoingItemSelection | null {
  if (panel === "calendars" && calendar) return { item: calendar, type: "calendar" };
  if (panel === "next-actions" && nextAction) return { item: nextAction, type: "next-action" };
  return null;
}

export function focusOnGoingPanel(
  state: OnGoingSelectionState,
  panel: OnGoingPanelId
): OnGoingSelectionState {
  return { ...state, activePanel: panel };
}

export function listZoneForOnGoingPanel(panel: OnGoingPanelId): FocusZoneId {
  return panel === "calendars" ? "ongoing-calendars-list" : "next-actions-list";
}

export function selectOnGoingPanelItem(
  state: OnGoingSelectionState,
  id: string | null
): OnGoingSelectionState {
  if (state.activePanel === "calendars") return { ...state, selectedCalendarId: id };
  return { ...state, selectedNextActionId: id };
}

export function actionLabelForOnGoingSelection(
  kind: OnGoingActionKind,
  selection: OnGoingItemSelection
): string {
  const noun = selection.type === "calendar" ? "calendar" : "next action";
  if (kind === "restore") return `Reset status to ${noun}`;
  if (kind === "done") return "Mark as done";
  return `Delete selected on going ${noun}`;
}
