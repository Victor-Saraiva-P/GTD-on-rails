import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  areJumpEntriesEqual,
  createJumpList,
  jumpBack,
  jumpForward,
  pushJump,
  type JumpEntry
} from "../src/features/navigation/jumpList.ts";

describe("jumpList", () => {
  const inboxEntry: JumpEntry = { screen: "inbox", selectedItemId: "item-1" };
  const nextActionsEntry: JumpEntry = { screen: "next-actions", selectedItemId: "item-2" };
  const projectDetailEntry: JumpEntry = {
    screen: "project-detail",
    projectId: "p-1",
    projectTitle: "Project 1",
    selectedItemId: "item-2"
  };

  test("createJumpList initializes empty state or with initial entry", () => {
    const empty = createJumpList();
    assert.equal(empty.entries.length, 0);
    assert.equal(empty.currentIndex, -1);

    const withInitial = createJumpList(inboxEntry);
    assert.equal(withInitial.entries.length, 1);
    assert.equal(withInitial.currentIndex, 0);
    assert.deepEqual(withInitial.entries[0], inboxEntry);
  });

  test("areJumpEntriesEqual compares screen, projectId, and selectedItemId", () => {
    assert.equal(areJumpEntriesEqual(inboxEntry, inboxEntry), true);
    assert.equal(
      areJumpEntriesEqual(inboxEntry, { screen: "inbox", selectedItemId: "item-1", zone: "inbox-list" }),
      true
    );
    assert.equal(areJumpEntriesEqual(inboxEntry, nextActionsEntry), false);
    assert.equal(areJumpEntriesEqual(inboxEntry, null), false);
    assert.equal(areJumpEntriesEqual(null, undefined), false);
  });

  test("pushJump adds fromEntry and toEntry when starting with empty state", () => {
    const initial = createJumpList();
    const updated = pushJump(initial, inboxEntry, nextActionsEntry);

    assert.equal(updated.entries.length, 2);
    assert.equal(updated.currentIndex, 1);
    assert.deepEqual(updated.entries[0], inboxEntry);
    assert.deepEqual(updated.entries[1], nextActionsEntry);
  });

  test("pushJump ignores duplicate jumps to the same location", () => {
    const initial = createJumpList(inboxEntry);
    const updated = pushJump(initial, inboxEntry, inboxEntry);

    assert.equal(updated.entries.length, 1);
    assert.equal(updated.currentIndex, 0);
  });

  test("jumpBack and jumpForward navigate history like Vim Ctrl-O and Ctrl-I", () => {
    let state = createJumpList();
    state = pushJump(state, inboxEntry, nextActionsEntry);
    state = pushJump(state, nextActionsEntry, projectDetailEntry);

    assert.equal(state.entries.length, 3);
    assert.equal(state.currentIndex, 2);

    // Ctrl-O: from projectDetail to nextActions
    const back1 = jumpBack(state);
    assert.ok(back1);
    assert.deepEqual(back1.entry, nextActionsEntry);
    assert.equal(back1.state.currentIndex, 1);

    // Ctrl-O: from nextActions to inbox
    const back2 = jumpBack(back1.state);
    assert.ok(back2);
    assert.deepEqual(back2.entry, inboxEntry);
    assert.equal(back2.state.currentIndex, 0);

    // Cannot go back further than first entry
    const back3 = jumpBack(back2.state);
    assert.equal(back3, null);

    // Ctrl-I: from inbox forward to nextActions
    const forward1 = jumpForward(back2.state);
    assert.ok(forward1);
    assert.deepEqual(forward1.entry, nextActionsEntry);
    assert.equal(forward1.state.currentIndex, 1);

    // Ctrl-I: forward to projectDetail
    const forward2 = jumpForward(forward1.state);
    assert.ok(forward2);
    assert.deepEqual(forward2.entry, projectDetailEntry);
    assert.equal(forward2.state.currentIndex, 2);

    // Cannot go forward past latest entry
    const forward3 = jumpForward(forward2.state);
    assert.equal(forward3, null);
  });

  test("pushJump truncates forward history when jumping from an older position", () => {
    let state = createJumpList();
    state = pushJump(state, inboxEntry, nextActionsEntry);
    state = pushJump(state, nextActionsEntry, projectDetailEntry);

    // Go back to nextActions (index 1)
    const back = jumpBack(state);
    assert.ok(back);

    // Jump to a new screen from nextActions
    const calendarsEntry: JumpEntry = { screen: "calendars", selectedItemId: "cal-1" };
    const branched = pushJump(back.state, nextActionsEntry, calendarsEntry);

    assert.equal(branched.entries.length, 3);
    assert.deepEqual(branched.entries, [inboxEntry, nextActionsEntry, calendarsEntry]);
    assert.equal(branched.currentIndex, 2);
  });
});
