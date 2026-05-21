import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  actionLabelForOnGoingSelection,
  activeOnGoingSelection,
  focusOnGoingPanel,
  listZoneForOnGoingPanel,
  selectOnGoingPanelItem,
  type OnGoingSelectionState
} from "../src/features/ongoing/combinedOnGoingState.ts";
import type { Calendar } from "../src/features/calendar/types.ts";
import type { NextAction } from "../src/features/next-actions/types.ts";

const body = { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] };
const nextAction: NextAction = { id: "na-1", title: "Call", body, createdAt: "", status: "ONGOING" };
const calendar: Calendar = { id: "cal-1", title: "Meet", body, createdAt: "", scheduledDate: "2026-05-21", scheduledTime: null, status: "ONGOING" };

describe("combined on going state", () => {
  test("panel switching preserves independent selections", () => {
    const state: OnGoingSelectionState = {
      activePanel: "next-actions",
      selectedCalendarId: "cal-1",
      selectedNextActionId: "na-1"
    };

    const switched = focusOnGoingPanel(state, "calendars");

    assert.equal(switched.activePanel, "calendars");
    assert.equal(switched.selectedNextActionId, "na-1");
    assert.equal(switched.selectedCalendarId, "cal-1");
  });

  test("selection updates only the active panel", () => {
    const state = focusOnGoingPanel({
      activePanel: "next-actions",
      selectedCalendarId: "cal-1",
      selectedNextActionId: "na-1"
    }, "calendars");

    const selected = selectOnGoingPanelItem(state, "cal-2");

    assert.equal(selected.selectedCalendarId, "cal-2");
    assert.equal(selected.selectedNextActionId, "na-1");
  });

  test("active selection determines detail type", () => {
    assert.equal(activeOnGoingSelection("next-actions", nextAction, calendar)?.type, "next-action");
    assert.equal(activeOnGoingSelection("calendars", nextAction, calendar)?.type, "calendar");
  });

  test("panel focus maps to independent list zones", () => {
    assert.equal(listZoneForOnGoingPanel("next-actions"), "next-actions-list");
    assert.equal(listZoneForOnGoingPanel("calendars"), "ongoing-calendars-list");
  });

  test("action labels adapt delete, done, and restore to selected type", () => {
    const selection = activeOnGoingSelection("calendars", nextAction, calendar);
    assert.ok(selection);
    assert.equal(actionLabelForOnGoingSelection("delete", selection), "Delete selected on going calendar");
    assert.equal(actionLabelForOnGoingSelection("done", selection), "Mark as done");
    assert.equal(actionLabelForOnGoingSelection("restore", selection), "Restore as calendar");
  });
});
