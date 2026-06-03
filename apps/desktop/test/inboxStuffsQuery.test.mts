import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { removeProcessedInboxStuff } from "../src/features/inbox/inboxStuffCollections.ts";
import type { Stuff } from "../src/features/inbox/types.ts";

describe("inbox stuffs query", () => {
  test("removeProcessedInboxStuff removes the processed stuff locally", () => {
    const currentStuffs = [stuff("first"), stuff("second")];

    const nextStuffs = removeProcessedInboxStuff(currentStuffs, "first");

    assert.deepEqual(nextStuffs, [currentStuffs[1]]);
  });

  test("removeProcessedInboxStuff keeps the list unchanged for missing ids", () => {
    const currentStuffs = [stuff("first")];

    const nextStuffs = removeProcessedInboxStuff(currentStuffs, "missing");

    assert.deepEqual(nextStuffs, currentStuffs);
  });
});

function stuff(id: string): Stuff {
  return {
    id,
    title: `Stuff ${id}`,
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    status: "STUFF",
    createdAt: "2026-05-01T00:00:00Z"
  };
}
