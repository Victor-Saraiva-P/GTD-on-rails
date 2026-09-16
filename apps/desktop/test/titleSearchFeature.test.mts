import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  computeTitleMatches,
  resolveNextMatchIndex,
  splitTitleSegments
} from "../src/features/title-search/titleSearchMatcher.ts";
import type { SearchableItem } from "../src/features/title-search/types.ts";

describe("title-search feature", () => {
  describe("splitTitleSegments", () => {
    test("returns single non-matching segment when query is empty", () => {
      assert.deepEqual(splitTitleSegments("Sample Task", ""), [
        { isMatch: false, text: "Sample Task" }
      ]);
    });

    test("splits single match preserving original casing", () => {
      const segments = splitTitleSegments("Read Documentation Today", "doc");
      assert.deepEqual(segments, [
        { isMatch: false, text: "Read " },
        { isMatch: true, text: "Doc" },
        { isMatch: false, text: "umentation Today" }
      ]);
    });

    test("handles multiple occurrences of same word", () => {
      const segments = splitTitleSegments("Test test TEST", "test");
      assert.deepEqual(segments, [
        { isMatch: true, text: "Test" },
        { isMatch: false, text: " " },
        { isMatch: true, text: "test" },
        { isMatch: false, text: " " },
        { isMatch: true, text: "TEST" }
      ]);
    });
  });

  describe("computeTitleMatches", () => {
    const items: SearchableItem[] = [
      { id: "1", title: "Refactor inbox controller" },
      { id: "2", title: "Fix calendar date sync" },
      { id: "3", title: "Refactor database migration" },
      { id: "4", title: "Review pull request" }
    ];

    test("filters matching items case-insensitively with correct indices", () => {
      const matches = computeTitleMatches(items, "refactor");
      assert.equal(matches.length, 2);
      assert.equal(matches[0].id, "1");
      assert.equal(matches[0].index, 0);
      assert.equal(matches[1].id, "3");
      assert.equal(matches[1].index, 2);
    });

    test("returns empty array when query does not match any item", () => {
      assert.deepEqual(computeTitleMatches(items, "banana"), []);
    });

    test("returns empty array for whitespace query", () => {
      assert.deepEqual(computeTitleMatches(items, "   "), []);
    });
  });

  describe("resolveNextMatchIndex", () => {
    test("moves next and wraps around at the end", () => {
      assert.equal(resolveNextMatchIndex(0, 3, 1), 1);
      assert.equal(resolveNextMatchIndex(1, 3, 1), 2);
      assert.equal(resolveNextMatchIndex(2, 3, 1), 0);
    });

    test("moves previous and wraps around at the beginning", () => {
      assert.equal(resolveNextMatchIndex(0, 3, -1), 2);
      assert.equal(resolveNextMatchIndex(2, 3, -1), 1);
      assert.equal(resolveNextMatchIndex(1, 3, -1), 0);
    });

    test("handles negative current index", () => {
      assert.equal(resolveNextMatchIndex(-1, 3, 1), 0);
      assert.equal(resolveNextMatchIndex(-1, 3, -1), 2);
    });

    test("handles empty matches collection", () => {
      assert.equal(resolveNextMatchIndex(0, 0, 1), -1);
      assert.equal(resolveNextMatchIndex(0, 0, -1), -1);
    });
  });
});
