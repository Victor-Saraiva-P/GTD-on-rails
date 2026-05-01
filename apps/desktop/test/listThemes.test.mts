import assert from "node:assert/strict";
import test from "node:test";

import {
  contextsListTheme,
  inboxListTheme,
  stuffDetailListTheme
} from "../src/features/lists/listThemes.ts";

test("inboxListTheme defines correct default styling", () => {
  assert.equal(inboxListTheme.id, "inbox");
  assert.equal(inboxListTheme.label, "Inbox");
  assert.ok(inboxListTheme.accentColor.startsWith("#"));
});

test("stuffDetailListTheme defines correct default styling", () => {
  assert.equal(stuffDetailListTheme.id, "stuff-detail");
  assert.equal(stuffDetailListTheme.label, "Stuff Detail");
  assert.ok(stuffDetailListTheme.accentColor.startsWith("#"));
});

test("contextsListTheme defines correct default styling", () => {
  assert.equal(contextsListTheme.id, "contexts");
  assert.equal(contextsListTheme.label, "Contexts");
  assert.ok(contextsListTheme.accentColor.startsWith("#"));
});
