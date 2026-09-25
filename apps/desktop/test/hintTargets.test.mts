import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { getInteractiveHintTargets } from "../src/features/keybinds/hintTargets.ts";

describe("getInteractiveHintTargets", () => {
  test("returns elements matching selectors and visible", () => {
    const fakeBtn1 = {
      closest: () => null,
      matches: () => false,
      getBoundingClientRect: () => ({ width: 100, height: 30, left: 10, right: 110, top: 10, bottom: 40 })
    };
    const fakeBtn2 = {
      closest: () => null,
      matches: () => false,
      getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 })
    };
    const fakeRoot = {
      querySelectorAll: () => [fakeBtn1, fakeBtn2]
    };

    const targets = getInteractiveHintTargets(fakeRoot as never);
    assert.equal(targets.length, 1);
    assert.equal(targets[0], fakeBtn1);
  });

  test("filters out elements inside .gtd-hint-overlay or marked data-hint-ignore", () => {
    const ignoredBtn = {
      closest: (sel: string) => (sel.includes("gtd-hint-overlay") ? {} : null),
      matches: () => false,
      getBoundingClientRect: () => ({ width: 50, height: 20, left: 10, right: 60, top: 10, bottom: 30 })
    };
    const fakeRoot = {
      querySelectorAll: () => [ignoredBtn]
    };

    const targets = getInteractiveHintTargets(fakeRoot as never);
    assert.equal(targets.length, 0);
  });
});
