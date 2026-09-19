import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { resolveZoomDetailZone } from "../src/features/zoom-mode/zoomModeTransitions.ts";

describe("zoomModeTransitions", () => {
  test("resolves inbox-list to stuff-detail", () => {
    assert.equal(resolveZoomDetailZone("inbox-list"), "stuff-detail");
    assert.equal(resolveZoomDetailZone("deleted-inbox-list"), "stuff-detail");
  });

  test("resolves next actions list variants to appropriate detail zones", () => {
    assert.equal(resolveZoomDetailZone("next-actions-list"), "next-action-detail");
    assert.equal(resolveZoomDetailZone("done-next-actions-list"), "done-next-action-detail");
    assert.equal(resolveZoomDetailZone("deleted-next-actions-list"), "deleted-next-action-detail");
    assert.equal(resolveZoomDetailZone("ongoing-next-actions-list"), "ongoing-next-action-detail");
  });

  test("resolves someday-maybe and calendars list zones", () => {
    assert.equal(resolveZoomDetailZone("someday-maybe-list"), "someday-maybe-detail");
    assert.equal(resolveZoomDetailZone("deleted-someday-maybe-list"), "someday-maybe-detail");
    assert.equal(resolveZoomDetailZone("calendars-today"), "calendar-detail");
    assert.equal(resolveZoomDetailZone("calendars-weekly"), "calendar-detail");
  });

  test("returns null for non-list or unknown zones", () => {
    assert.equal(resolveZoomDetailZone("stuff-detail"), null);
    assert.equal(resolveZoomDetailZone("next-action-detail"), null);
    assert.equal(resolveZoomDetailZone("unknown-zone"), null);
    assert.equal(resolveZoomDetailZone(""), null);
  });
});
