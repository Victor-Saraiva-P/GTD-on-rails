import assert from "node:assert/strict";
import test from "node:test";

import { CONTEXT_RELATED_ITEMS_LIMIT } from "../src/features/contexts/constants.ts";

test("CONTEXT_RELATED_ITEMS_LIMIT is positive and reasonable", () => {
  assert.ok(CONTEXT_RELATED_ITEMS_LIMIT > 0, "limit must be greater than zero");
  assert.ok(CONTEXT_RELATED_ITEMS_LIMIT <= 100, "limit should not be excessively large");
  assert.equal(typeof CONTEXT_RELATED_ITEMS_LIMIT, "number");
});
