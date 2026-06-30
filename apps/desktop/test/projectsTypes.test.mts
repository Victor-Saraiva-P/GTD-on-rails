import assert from "node:assert/strict";
import test from "node:test";

import { formatProjectDeadline } from "../src/features/projects/types.ts";

test("formatProjectDeadline formats deadline cards", () => {
  assert.equal(formatProjectDeadline("2028-02-29"), "29 Feb 2028");
  assert.equal(formatProjectDeadline(null), null);
});
