import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  moveNextActionSelection,
  selectNextActionBoundary,
  selectedNextActionIndex,
  selectedNextActionItem
} from "../src/features/next-actions/nextActionSelection.ts";
import type { NextAction } from "../src/features/next-actions/types.ts";

function nextAction(id: string, title: string): NextAction {
  return {
    id,
    title,
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    status: "NEXT_ACTION",
    createdAt: "",
    contexts: [],
    energy: 1,
    estimatedTime: { hours: 0, minutes: 5 }
  };
}

describe("next action selection", () => {
  test("selects the requested next action or falls back to the first item", () => {
    const items = [nextAction("na-1", "First"), nextAction("na-2", "Second")];

    assert.equal(selectedNextActionItem(items, "na-2")?.title, "Second");
    assert.equal(selectedNextActionItem(items, "missing")?.title, "First");
  });

  test("tracks selected index for list movement", () => {
    const items = [nextAction("na-1", "First"), nextAction("na-2", "Second")];
    const selected = selectedNextActionItem(items, "na-2");

    assert.equal(selectedNextActionIndex(items, selected), 1);
  });

  test("moves within list boundaries", () => {
    const items = [nextAction("na-1", "First"), nextAction("na-2", "Second")];
    const selectedIds: (string | null)[] = [];
    const cursor = { items, selectedIndex: 1, setSelectedId: (id: string | null) => selectedIds.push(id) };

    moveNextActionSelection(cursor, 1);
    moveNextActionSelection(cursor, -1);

    assert.deepEqual(selectedIds, ["na-2", "na-1"]);
  });

  test("selects first and last next action boundaries", () => {
    const items = [nextAction("na-1", "First"), nextAction("na-2", "Second")];
    const selectedIds: (string | null)[] = [];
    const cursor = { items, selectedIndex: 1, setSelectedId: (id: string | null) => selectedIds.push(id) };

    selectNextActionBoundary(cursor, "first");
    selectNextActionBoundary(cursor, "last");

    assert.deepEqual(selectedIds, ["na-1", "na-2"]);
  });
});
