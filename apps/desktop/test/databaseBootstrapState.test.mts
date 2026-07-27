import assert from "node:assert/strict";
import test from "node:test";

import { bootstrapUiState } from "../src/features/bootstrap/databaseBootstrapState.ts";

test("missing configuration opens first-installation setup", () => {
  assert.equal(bootstrapUiState("MISSING"), "setup");
});

test("invalid configuration opens explicit repair", () => {
  assert.equal(bootstrapUiState("INVALID"), "repair");
  assert.equal(bootstrapUiState("REPAIR_FAILED"), "repair");
});

test("unknown bootstrap status remains offline", () => {
  assert.equal(bootstrapUiState("FAILED"), "offline");
});
