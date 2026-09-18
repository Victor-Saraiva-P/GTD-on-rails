import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { generateHintLabels } from "../src/features/keybinds/hintLabels.ts";

describe("generateHintLabels", () => {
  test("returns empty array when count is 0 or negative", () => {
    assert.deepEqual(generateHintLabels(0), []);
    assert.deepEqual(generateHintLabels(-5), []);
  });

  test("generates single-character labels up to available base count", () => {
    const labels = generateHintLabels(5);
    assert.equal(labels.length, 5);
    assert.deepEqual(labels, ["f", "j", "d", "k", "s"]);
  });

  test("generates two-character labels when count exceeds base character pool", () => {
    const labels = generateHintLabels(25);
    assert.equal(labels.length, 25);
    assert.equal(labels[0], "ff");
    assert.equal(labels[1], "fj");
    assert.equal(labels[2], "fd");
    // All labels must be unique
    const unique = new Set(labels);
    assert.equal(unique.size, 25);
  });
});
