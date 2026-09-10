import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { projectItemsWithDraft } from "../src/features/projects/projectDetailItems.ts";
import type { ProjectItem } from "../src/features/projects/projectItems.ts";

function createItem(id: string, kind: ProjectItem["kind"], title: string): ProjectItem {
  return {
    id,
    kind,
    title,
    projectId: "p-1",
    status: kind === "CALENDAR" ? "CALENDAR" : kind === "NEXT_ACTION" ? "NEXT_ACTION" : "STUFF",
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    createdAt: new Date().toISOString()
  };
}

describe("projectItemsWithDraft", () => {
  const existingItems: ProjectItem[] = [
    createItem("item-1", "CALENDAR", "Calendar item"),
    createItem("item-2", "NEXT_ACTION", "Next action item")
  ];

  test("returns original items when draft is null", () => {
    const result = projectItemsWithDraft(null, existingItems);
    assert.deepEqual(result, existingItems);
  });

  test("prepends draft item at index 0 when draft is present", () => {
    const draft = createItem("__draft__", "STUFF", "");
    const result = projectItemsWithDraft(draft, existingItems);

    assert.equal(result.length, 3);
    assert.equal(result[0]?.id, "__draft__");
    assert.equal(result[0]?.kind, "STUFF");
    assert.equal(result[1]?.id, "item-1");
    assert.equal(result[2]?.id, "item-2");
  });

  test("prepends draft item in first position when items already contain stuff", () => {
    const itemsWithStuff: ProjectItem[] = [
      createItem("stuff-1", "STUFF", "Existing stuff"),
      createItem("item-1", "CALENDAR", "Calendar item")
    ];
    const draft = createItem("__draft__", "STUFF", "");
    const result = projectItemsWithDraft(draft, itemsWithStuff);

    assert.equal(result.length, 3);
    assert.equal(result[0]?.id, "__draft__");
    assert.equal(result[1]?.id, "stuff-1");
  });
});
