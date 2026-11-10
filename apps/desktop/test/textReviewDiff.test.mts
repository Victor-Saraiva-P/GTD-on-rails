import assert from "node:assert/strict";
import test from "node:test";
import { diffReviewText } from "../src/features/agent-processing/textReviewDiff.ts";

test("renders a Git-style title replacement without changing the original text", () => {
  assert.deepEqual(diffReviewText("comprar fita", "Comprar fita para o pôster"), [
    { kind: "remove", text: "comprar fita" },
    { kind: "add", text: "Comprar fita para o pôster" }
  ]);
});

test("preserves unchanged body lines while distinguishing inserted and removed ones", () => {
  assert.deepEqual(diffReviewText("Travel plan\nBuy tape\nDone", "Travel plan\nCheck adhesive\nDone"), [
    { kind: "same", text: "Travel plan" },
    { kind: "remove", text: "Buy tape" },
    { kind: "add", text: "Check adhesive" },
    { kind: "same", text: "Done" }
  ]);
});

test("shows additions for empty original bodies and nothing for unchanged text", () => {
  assert.deepEqual(diffReviewText("", "Context added"), [{ kind: "add", text: "Context added" }]);
  assert.deepEqual(diffReviewText("Keep context", "Keep context"), []);
});

test("does not allocate a quadratic comparison table for very long multiline notes", () => {
  const original = Array.from({ length: 201 }, (_, index) => `old ${index}`).join("\n");
  const proposal = Array.from({ length: 201 }, (_, index) => `new ${index}`).join("\n");
  const lines = diffReviewText(original, proposal);
  assert.equal(lines.length, 402);
  assert.equal(lines[0].kind, "remove");
  assert.equal(lines[201].kind, "add");
  assert.equal(lines[401].text, "new 200");
});
