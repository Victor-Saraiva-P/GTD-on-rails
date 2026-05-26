import assert from "node:assert/strict";
import test from "node:test";

import { shouldCheckNativeUpdates } from "../src/components/nativeUpdatePolicy.ts";

test("native update checks run for packaged Tauri boots", () => {
  assert.equal(shouldCheckNativeUpdates(true, false), true);
});

test("native update checks are skipped outside Tauri", () => {
  assert.equal(shouldCheckNativeUpdates(false, false), false);
});

test("native update checks are skipped during Tauri development", () => {
  assert.equal(shouldCheckNativeUpdates(true, true), false);
});
