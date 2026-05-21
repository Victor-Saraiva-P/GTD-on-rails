import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarItemIconText,
  calendarsListTheme,
  contextsListTheme,
  doneCalendarsListTheme,
  doneNextActionsListTheme,
  inboxListTheme,
  nextActionsListTheme,
  stuffDetailListTheme
} from "../src/features/lists/listThemes.ts";

test("inboxListTheme defines correct default styling", () => {
  assert.equal(inboxListTheme.id, "inbox");
  assert.equal(inboxListTheme.label, "Inbox");
  assert.ok(inboxListTheme.accentColor.startsWith("#"));
});

test("stuffDetailListTheme defines correct default styling", () => {
  assert.equal(stuffDetailListTheme.id, "stuff-detail");
  assert.equal(stuffDetailListTheme.label, "Stuff Detail");
  assert.ok(stuffDetailListTheme.accentColor.startsWith("#"));
});

test("contextsListTheme defines correct default styling", () => {
  assert.equal(contextsListTheme.id, "contexts");
  assert.equal(contextsListTheme.label, "Contexts");
  assert.ok(contextsListTheme.accentColor.startsWith("#"));
});

test("nextActionsListTheme defines green next actions styling", () => {
  assert.equal(nextActionsListTheme.id, "next-actions");
  assert.equal(nextActionsListTheme.label, "Next Actions");
  assert.equal(nextActionsListTheme.accentColor, "#4F9768");
});

test("calendarsListTheme reuses inbox red accent", () => {
  assert.equal(calendarsListTheme.id, "calendars");
  assert.equal(calendarsListTheme.accentColor, inboxListTheme.accentColor);
  assert.equal(calendarItemIconText, "C");
});

test("doneCalendarsListTheme reuses completed next actions green", () => {
  assert.equal(doneCalendarsListTheme.accentColor, doneNextActionsListTheme.accentColor);
});
