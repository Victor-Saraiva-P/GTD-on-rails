import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { resolveProjectItemDestination } from "../src/features/navigation/projectItemDestination.ts";
import type { ProjectItem } from "../src/features/projects/projectItems.ts";

function createItem(kind: ProjectItem["kind"], id = "item-1"): ProjectItem {
  return {
    id,
    projectId: "p-1",
    kind,
    title: "Test Item",
    status: kind,
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    createdAt: new Date().toISOString()
  };
}

describe("projectItemDestination", () => {
  test("returns null for null, undefined, or draft items", () => {
    assert.equal(resolveProjectItemDestination(null), null);
    assert.equal(resolveProjectItemDestination(undefined), null);
    assert.equal(resolveProjectItemDestination(createItem("STUFF", "__draft_project_item__")), null);
  });

  test("resolves NEXT_ACTION to next-actions screen and list zone", () => {
    const item = createItem("NEXT_ACTION", "na-100");
    assert.deepEqual(resolveProjectItemDestination(item), {
      screen: "next-actions",
      zone: "next-actions-list",
      selectedItemId: "na-100"
    });
  });

  test("resolves CALENDAR to calendars screen and due panel zone", () => {
    const item = createItem("CALENDAR", "cal-200");
    assert.deepEqual(resolveProjectItemDestination(item), {
      screen: "calendars",
      zone: "calendar-today-due-panel",
      selectedItemId: "cal-200"
    });
  });

  test("resolves STUFF to inbox screen and inbox list zone", () => {
    const item = createItem("STUFF", "stuff-300");
    assert.deepEqual(resolveProjectItemDestination(item), {
      screen: "inbox",
      zone: "inbox-list",
      selectedItemId: "stuff-300"
    });
  });
});
