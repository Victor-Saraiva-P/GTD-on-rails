import assert from "node:assert/strict";
import test from "node:test";

import { projectSubviewTarget } from "../src/features/projects/projectSubview.ts";

test("projectSubviewTarget cycles active and completed projects", () => {
  assert.equal(projectSubviewTarget("active"), "completed");
  assert.equal(projectSubviewTarget("completed"), "active");
});
