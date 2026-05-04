import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStuffBodyVimCommand,
  formatStuffBodyVimMode,
  initialStuffBodyVimState,
  moveStuffBodyCursor,
  stuffBodyCursorCell
} from "../src/features/inbox/stuffBodyVim.ts";

test("formatStuffBodyVimMode formats supported footer labels", () => {
  assert.equal(formatStuffBodyVimMode("normal"), "NORMAL");
  assert.equal(formatStuffBodyVimMode("insert"), "INSERT");
  assert.equal(formatStuffBodyVimMode("visual"), "VISUAL");
  assert.equal(formatStuffBodyVimMode("visual-line"), "VISUAL LINE");
  assert.equal(formatStuffBodyVimMode(null), null);
});

test("moveStuffBodyCursor follows hjkl within body bounds", () => {
  const value = "one\ntwo";

  assert.equal(moveStuffBodyCursor(value, 0, "h"), 0);
  assert.equal(moveStuffBodyCursor(value, 0, "l"), 1);
  assert.equal(moveStuffBodyCursor(value, 1, "j"), 5);
  assert.equal(moveStuffBodyCursor(value, 5, "k"), 1);
});

test("moveStuffBodyCursor moves by word starts", () => {
  const value = "one two\nthree";

  assert.equal(moveStuffBodyCursor(value, 0, "w"), 4);
  assert.equal(moveStuffBodyCursor(value, 8, "b"), 4);
});

test("moveStuffBodyCursor stops at the last existing character", () => {
  assert.equal(moveStuffBodyCursor("abc.", 3, "l"), 3);
});

test("stuffBodyCursorCell renders empty line cursors as blank cells", () => {
  assert.deepEqual(stuffBodyCursorCell("one\n\nthree", 4), {
    character: " ",
    column: 0,
    line: 1
  });
});

test("applyStuffBodyVimCommand enters insert mode from normal mode", () => {
  const update = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    key: "i",
    value: "body"
  });

  assert.equal(update.handled, true);
  assert.equal(update.mode, "insert");
});

test("applyStuffBodyVimCommand moves from the logical block cursor in normal mode", () => {
  const right = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    key: "l",
    selectionEnd: 1,
    selectionStart: 0,
    value: "abc"
  });
  const left = applyStuffBodyVimCommand({ ...right, key: "h", selectionEnd: 2, selectionStart: 1 });

  assert.deepEqual([right.selectionStart, right.selectionEnd], [1, 1]);
  assert.deepEqual([left.selectionStart, left.selectionEnd], [0, 0]);
});

test("applyStuffBodyVimCommand returns to normal mode from insert mode", () => {
  const update = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    key: "Escape",
    mode: "insert",
    selectionEnd: 3,
    selectionStart: 3,
    value: "body"
  });

  assert.equal(update.mode, "normal");
  assert.equal(update.selectionStart, 3);
});

test("applyStuffBodyVimCommand supports gg and G line jumps", () => {
  const bottom = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    key: "G",
    value: "one\ntwo\nthree"
  });
  const top = applyStuffBodyVimCommand({ ...bottom, key: "g", pendingKey: "g" });

  assert.equal(bottom.selectionStart, 8);
  assert.equal(top.selectionStart, 0);
});

test("applyStuffBodyVimCommand opens a new line below", () => {
  const update = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    key: "o",
    value: "one"
  });

  assert.equal(update.mode, "insert");
  assert.equal(update.value, "one\n");
  assert.equal(update.selectionStart, 4);
});

test("applyStuffBodyVimCommand deletes the current line with dd", () => {
  const pending = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    key: "d",
    value: "one\ntwo\nthree"
  });
  const update = applyStuffBodyVimCommand({
    ...pending,
    activeCursor: 4,
    key: "d",
    selectionEnd: 4,
    selectionStart: 4
  });

  assert.equal(update.value, "one\nthree");
  assert.equal(update.selectionStart, 4);
});

test("applyStuffBodyVimCommand copies visual selections", () => {
  const update = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    key: "y",
    mode: "visual",
    selectionEnd: 4,
    selectionStart: 0,
    value: "body"
  });

  assert.equal(update.copiedText, "body");
  assert.equal(update.mode, "normal");
});

test("applyStuffBodyVimCommand tracks the active visual cursor", () => {
  const firstMove = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    activeCursor: 2,
    key: "h",
    mode: "visual",
    selectionEnd: 2,
    selectionStart: 2,
    value: "body",
    visualAnchor: 2
  });
  const secondMove = applyStuffBodyVimCommand({ ...firstMove, key: "h" });

  assert.deepEqual([secondMove.selectionStart, secondMove.selectionEnd], [0, 2]);
});

test("applyStuffBodyVimCommand selects whole lines in visual-line mode", () => {
  const update = applyStuffBodyVimCommand({
    ...initialStuffBodyVimState,
    key: "V",
    selectionEnd: 1,
    selectionStart: 1,
    value: "one\ntwo"
  });

  assert.equal(update.mode, "visual-line");
  assert.deepEqual([update.selectionStart, update.selectionEnd], [0, 3]);
});
