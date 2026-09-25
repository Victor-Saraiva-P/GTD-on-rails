import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  computeLogicalTarget,
  enterInsertAtDisplayBoundaryAction,
  isCountTyped,
  moveByDisplayLineMotion,
  moveToDisplayBoundaryMotion,
  registerDisplayLineMotions,
  shouldMoveByLogicalLine,
  type VimActionTable,
  type VimDisplayBoundaryCm,
  type VimMotionCm,
  type VimMotionState
} from "../src/features/inbox/cmDisplayLineMotion.ts";

describe("cmDisplayLineMotion", () => {
  describe("isCountTyped", () => {
    test("returns true if explicit flag is set", () => {
      assert.equal(isCountTyped(true), true);
    });

    test("returns true if prefixRepeat has digits", () => {
      assert.equal(isCountTyped(false, { prefixRepeat: ["3"] }), true);
    });

    test("returns true if motionRepeat has digits", () => {
      assert.equal(isCountTyped(false, { motionRepeat: ["5"] }), true);
    });

    test("returns false when no count is present", () => {
      assert.equal(isCountTyped(false, {}), false);
      assert.equal(isCountTyped(undefined, undefined), false);
    });
  });

  describe("shouldMoveByLogicalLine", () => {
    test("returns true in visualLine or visualBlock mode", () => {
      assert.equal(shouldMoveByLogicalLine({ visualLine: true }, false), true);
      assert.equal(shouldMoveByLogicalLine({ visualBlock: true }, false), true);
    });

    test("returns true when operator is pending", () => {
      assert.equal(shouldMoveByLogicalLine({ inputState: { operator: "delete" } }, false), true);
    });

    test("returns true when count was typed", () => {
      assert.equal(shouldMoveByLogicalLine({}, true), true);
    });

    test("returns false for bare motion in normal/visual mode", () => {
      assert.equal(shouldMoveByLogicalLine({}, false), false);
    });
  });

  describe("computeLogicalTarget", () => {
    test("advances forward by repeat amount clamped to lastLine", () => {
      assert.equal(computeLogicalTarget(0, 10, 2, 3, true), 5);
      assert.equal(computeLogicalTarget(0, 10, 9, 3, true), 10);
    });

    test("retreats backward by repeat amount clamped to firstLine", () => {
      assert.equal(computeLogicalTarget(0, 10, 5, 2, false), 3);
      assert.equal(computeLogicalTarget(0, 10, 1, 3, false), 0);
    });
  });

  describe("moveByDisplayLineMotion", () => {
    test("uses logical target when count was typed", () => {
      const fakeCm: VimMotionCm = {
        firstLine: () => 0,
        lastLine: () => 10,
        findPosV: () => ({ line: 99, ch: 0 }),
        charCoords: () => ({ left: 10 })
      };
      const vim: VimMotionState = {};
      const pos = moveByDisplayLineMotion(fakeCm, { line: 2, ch: 5 }, { forward: true, repeat: 3, repeatIsExplicit: true }, vim);
      assert.equal(pos.line, 5);
      assert.equal(pos.ch, 5);
    });

    test("uses findPosV when bare motion without count", () => {
      const fakeCm: VimMotionCm = {
        firstLine: () => 0,
        lastLine: () => 10,
        findPosV: (_start, amount, unit) => {
          assert.equal(unit, "line");
          assert.equal(amount, 1);
          return { line: 3, ch: 8 };
        },
        charCoords: () => ({ left: 15 })
      };
      const vim: VimMotionState = {};
      const pos = moveByDisplayLineMotion(fakeCm, { line: 2, ch: 5 }, { forward: true, repeat: 1 }, vim);
      assert.equal(pos.line, 3);
      assert.equal(pos.ch, 8);
      assert.equal(vim.lastHPos, 8);
    });

    test("falls back to logical target if findPosV throws", () => {
      const fakeCm: VimMotionCm = {
        firstLine: () => 0,
        lastLine: () => 10,
        findPosV: () => {
          throw new Error("geometry error");
        },
        charCoords: () => ({ left: 15 })
      };
      const vim: VimMotionState = {};
      const pos = moveByDisplayLineMotion(fakeCm, { line: 2, ch: 5 }, { forward: false, repeat: 1 }, vim);
      assert.equal(pos.line, 1);
      assert.equal(pos.ch, 5);
    });
  });

  describe("moveToDisplayBoundaryMotion", () => {
    test("executes goLineRight on forward motion", () => {
      let executed = "";
      const fakeCm: VimDisplayBoundaryCm = {
        execCommand: (cmd) => {
          executed = cmd;
        },
        getCursor: () => ({ line: 2, ch: 25 })
      };
      const pos = moveToDisplayBoundaryMotion(fakeCm, { line: 2, ch: 0 }, { forward: true });
      assert.equal(executed, "goLineRight");
      assert.equal(pos.ch, 25);
    });

    test("executes goLineLeft on backward motion", () => {
      let executed = "";
      const fakeCm: VimDisplayBoundaryCm = {
        execCommand: (cmd) => {
          executed = cmd;
        },
        getCursor: () => ({ line: 2, ch: 0 })
      };
      const pos = moveToDisplayBoundaryMotion(fakeCm, { line: 2, ch: 10 }, { forward: false });
      assert.equal(executed, "goLineLeft");
      assert.equal(pos.ch, 0);
    });
  });

  describe("enterInsertAtDisplayBoundaryAction", () => {
    test("calls enterInsertMode with target position", () => {
      let insertedArgs: { head: { line: number; ch: number }; insertAt: string } | null = null;
      const fakeTable: VimActionTable = {
        enterInsertMode: (_cm, args) => {
          insertedArgs = args;
        }
      };
      const fakeCm: VimDisplayBoundaryCm = {
        execCommand: () => undefined,
        getCursor: () => ({ line: 1, ch: 20 })
      };
      enterInsertAtDisplayBoundaryAction.call(fakeTable, fakeCm, { forward: true }, null);
      assert.notEqual(insertedArgs, null);
      assert.equal(insertedArgs!.head.ch, 20);
      assert.equal(insertedArgs!.insertAt, "inplace");
    });
  });

  test("registerDisplayLineMotions runs idempotently", () => {
    assert.doesNotThrow(() => {
      registerDisplayLineMotions();
      registerDisplayLineMotions();
    });
  });
});
