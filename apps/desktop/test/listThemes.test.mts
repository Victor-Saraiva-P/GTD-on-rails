import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarItemIconText,
  calendarsListTheme,
  contextsListTheme,
  doneCalendarsListTheme,
  doneNextActionsListTheme,
  doneProjectsListTheme,
  deletedProjectsListTheme,
  inboxListTheme,
  nextActionsListTheme,
  projectsListTheme,
  stuffDetailListTheme
} from "../src/features/lists/listThemes.ts";

test("inboxListTheme defines correct default styling", () => {
  assert.equal(inboxListTheme.id, "inbox");
  assert.equal(inboxListTheme.label, "Inbox");
  assert.equal(inboxListTheme.accentColor, "#CC782F");
});

test("stuffDetailListTheme defines correct default styling", () => {
  assert.equal(stuffDetailListTheme.id, "stuff-detail");
  assert.equal(stuffDetailListTheme.label, "Stuff Detail");
  assert.equal(stuffDetailListTheme.accentColor, inboxListTheme.accentColor);
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

test("projectsListTheme defines purple projects styling", () => {
  assert.equal(projectsListTheme.id, "projects");
  assert.equal(projectsListTheme.label, "Projects");
  assert.equal(projectsListTheme.accentColor, "#9B5AB7");
});

test("calendarsListTheme keeps the calendar red accent", () => {
  assert.equal(calendarsListTheme.id, "calendars");
  assert.equal(calendarsListTheme.accentColor, "#c85a53");
  assert.equal(calendarItemIconText, "C");
});

test("doneCalendarsListTheme reuses completed next actions green", () => {
  assert.equal(doneCalendarsListTheme.accentColor, doneNextActionsListTheme.accentColor);
});

test("doneProjectsListTheme uses completed green", () => {
  assert.equal(doneProjectsListTheme.label, "Completed Projects");
  assert.equal(doneProjectsListTheme.accentColor, "#7F8D3F");
});

test("deletedProjectsListTheme uses deleted gray", () => {
  assert.equal(deletedProjectsListTheme.label, "Deleted Projects");
  assert.equal(deletedProjectsListTheme.accentColor, "#9B9B9B");
});
