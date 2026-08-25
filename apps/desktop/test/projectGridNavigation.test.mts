import assert from "node:assert/strict";
import test from "node:test";

import { nextProjectGridSelection } from "../src/features/projects/projectGridNavigation.ts";

test("project grid j moves to the nearest card below", () => {
  const cards = [
    projectRect("a", 0, 0),
    projectRect("b", 260, 0),
    projectRect("c", 520, 0),
    projectRect("d", 0, 160),
    projectRect("e", 260, 160)
  ];

  assert.equal(nextProjectGridSelection(cards, "a", "down"), "d");
  assert.equal(nextProjectGridSelection(cards, "b", "down"), "e");
});

test("project grid h and l move within a row", () => {
  const cards = [projectRect("a", 0, 0), projectRect("b", 260, 0), projectRect("c", 0, 160)];

  assert.equal(nextProjectGridSelection(cards, "a", "right"), "b");
  assert.equal(nextProjectGridSelection(cards, "b", "left"), "a");
  assert.equal(nextProjectGridSelection(cards, "a", "left"), "a");
});

function projectRect(id: string, left: number, top: number) {
  return { id, left, top, width: 240, height: 130 };
}
