import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  computeTitleMatches,
  resolveNextMatchIndex,
  splitTitleSegments
} from "../src/features/title-search/titleSearchMatcher.ts";
import type { SearchableItem } from "../src/features/title-search/types.ts";

describe("titleSearchMatcher", () => {
  describe("splitTitleSegments", () => {
    test("returns single non-matching segment when query is empty or whitespace", () => {
      assert.deepEqual(splitTitleSegments("Test Title", ""), [{ isMatch: false, text: "Test Title" }]);
      assert.deepEqual(splitTitleSegments("Test Title", "   "), [{ isMatch: false, text: "Test Title" }]);
    });

    test("returns single non-matching segment when query does not match", () => {
      assert.deepEqual(splitTitleSegments("Test Title", "xyz"), [{ isMatch: false, text: "Test Title" }]);
    });

    test("splits single match preserving original casing", () => {
      const segments = splitTitleSegments("Database Setup Service", "setup");
      assert.deepEqual(segments, [
        { isMatch: false, text: "Database " },
        { isMatch: true, text: "Setup" },
        { isMatch: false, text: " Service" }
      ]);
    });

    test("handles match at the very beginning of the title", () => {
      const segments = splitTitleSegments("Database Setup", "data");
      assert.deepEqual(segments, [
        { isMatch: true, text: "Data" },
        { isMatch: false, text: "base Setup" }
      ]);
    });

    test("handles match at the very end of the title", () => {
      const segments = splitTitleSegments("Database Setup", "setup");
      assert.deepEqual(segments, [
        { isMatch: false, text: "Database " },
        { isMatch: true, text: "Setup" }
      ]);
    });

    test("handles multiple occurrences in the same title", () => {
      const segments = splitTitleSegments("data and database", "data");
      assert.deepEqual(segments, [
        { isMatch: true, text: "data" },
        { isMatch: false, text: " and " },
        { isMatch: true, text: "data" },
        { isMatch: false, text: "base" }
      ]);
    });
  });

  describe("computeTitleMatches", () => {
    const items: SearchableItem[] = [
      { id: "1", title: "Buy groceries" },
      { id: "2", title: "Schedule database backup" },
      { id: "3", title: "Review quarterly data" }
    ];

    test("returns empty array for empty or whitespace query", () => {
      assert.deepEqual(computeTitleMatches(items, ""), []);
      assert.deepEqual(computeTitleMatches(items, "  "), []);
    });

    test("filters matching items case-insensitively with correct indices", () => {
      const matches = computeTitleMatches(items, "DATA");
      assert.deepEqual(matches, [
        { id: "2", index: 1, title: "Schedule database backup" },
        { id: "3", index: 2, title: "Review quarterly data" }
      ]);
    });

    test("returns empty array when no titles match", () => {
      assert.deepEqual(computeTitleMatches(items, "nonexistent"), []);
    });

    test("handles empty items array gracefully", () => {
      assert.deepEqual(computeTitleMatches([], "test"), []);
    });
  });

  describe("resolveNextMatchIndex", () => {
    test("returns -1 when totalMatches is 0 or negative", () => {
      assert.equal(resolveNextMatchIndex(0, 0, 1), -1);
      assert.equal(resolveNextMatchIndex(0, -1, -1), -1);
    });

    test("advances forward and wraps around to 0 at the end", () => {
      assert.equal(resolveNextMatchIndex(0, 3, 1), 1);
      assert.equal(resolveNextMatchIndex(1, 3, 1), 2);
      assert.equal(resolveNextMatchIndex(2, 3, 1), 0);
    });

    test("moves backward and wraps around to last index at the beginning", () => {
      assert.equal(resolveNextMatchIndex(2, 3, -1), 1);
      assert.equal(resolveNextMatchIndex(1, 3, -1), 0);
      assert.equal(resolveNextMatchIndex(0, 3, -1), 2);
    });

    test("initializes to 0 for step 1 or last for step -1 when current is -1", () => {
      assert.equal(resolveNextMatchIndex(-1, 3, 1), 0);
      assert.equal(resolveNextMatchIndex(-1, 3, -1), 2);
    });
  });
});
