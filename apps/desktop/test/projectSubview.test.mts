import assert from "node:assert/strict";
import test from "node:test";

import { projectSubviewTarget } from "../src/features/projects/projectSubview.ts";

test("projectSubviewTarget cycles project subviews by direction", () => {
  assert.equal(projectSubviewTarget("active", "next"), "completed");
  assert.equal(projectSubviewTarget("completed", "next"), "deleted");
  assert.equal(projectSubviewTarget("deleted", "next"), "active");
  assert.equal(projectSubviewTarget("active", "previous"), "deleted");
  assert.equal(projectSubviewTarget("deleted", "previous"), "completed");
});
