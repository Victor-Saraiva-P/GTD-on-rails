import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { resolveZenDetailZone } from "../src/features/zen-mode/zenModeTransitions.ts";

describe("zenModeTransitions", () => {
  test("resolves inbox-list to stuff-detail", () => {
    assert.equal(resolveZenDetailZone("inbox-list"), "stuff-detail");
    assert.equal(resolveZenDetailZone("deleted-inbox-list"), "stuff-detail");
  });

  test("resolves next actions list variants to appropriate detail zones", () => {
    assert.equal(resolveZenDetailZone("next-actions-list"), "next-action-detail");
    assert.equal(resolveZenDetailZone("done-next-actions-list"), "done-next-action-detail");
    assert.equal(resolveZenDetailZone("deleted-next-actions-list"), "deleted-next-action-detail");
    assert.equal(resolveZenDetailZone("ongoing-next-actions-list"), "ongoing-next-action-detail");
  });

  test("resolves someday-maybe and calendars list zones", () => {
    assert.equal(resolveZenDetailZone("someday-maybe-list"), "someday-maybe-detail");
    assert.equal(resolveZenDetailZone("deleted-someday-maybe-list"), "someday-maybe-detail");
    assert.equal(resolveZenDetailZone("calendars-today"), "calendar-detail");
    assert.equal(resolveZenDetailZone("calendars-weekly"), "calendar-detail");
  });

  test("returns null for non-list or unknown zones", () => {
    assert.equal(resolveZenDetailZone("stuff-detail"), null);
    assert.equal(resolveZenDetailZone("next-action-detail"), null);
    assert.equal(resolveZenDetailZone("unknown-zone"), null);
    assert.equal(resolveZenDetailZone(""), null);
  });
});
