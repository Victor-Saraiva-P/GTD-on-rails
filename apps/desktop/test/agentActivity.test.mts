import assert from "node:assert/strict";
import test from "node:test";
import { appendAgentActivity } from "../src/features/agent-processing/activity.ts";

test("appendAgentActivity collapses consecutive duplicate progress updates", () => {
  const initial = [{ kind: "response" as const, message: "Writing response" }];
  const next = appendAgentActivity(initial, { kind: "response", message: "Writing response" });
  assert.equal(next, initial);
});

test("appendAgentActivity keeps only the latest sixteen progress updates", () => {
  const entries = Array.from({ length: 16 }, (_, index) => ({ kind: "status" as const, message: `step ${index}` }));
  const next = appendAgentActivity(entries, { kind: "tool", message: "final step" });
  assert.equal(next.length, 16);
  assert.equal(next[0]?.message, "step 1");
  assert.equal(next.at(-1)?.message, "final step");
});
