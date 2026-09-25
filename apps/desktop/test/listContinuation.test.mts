import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { isEmptyListLine, listContinuationPrefix } from "../src/features/inbox/listContinuation.ts";

describe("listContinuationPrefix", () => {
  test("repeats bullet markers", () => {
    assert.equal(listContinuationPrefix("- foo"), "- ");
    assert.equal(listContinuationPrefix("* bar"), "* ");
    assert.equal(listContinuationPrefix("+ baz"), "+ ");
  });

  test("increments ordered list numbers", () => {
    assert.equal(listContinuationPrefix("1. foo"), "2. ");
    assert.equal(listContinuationPrefix("9. foo"), "10. ");
    assert.equal(listContinuationPrefix("3) foo"), "4) ");
  });

  test("preserves indentation", () => {
    assert.equal(listContinuationPrefix("  - nested"), "  - ");
    assert.equal(listContinuationPrefix("\t- tabbed"), "\t- ");
    assert.equal(listContinuationPrefix("   2. deep"), "   3. ");
  });

  test("continues tasks as fresh unchecked checkboxes", () => {
    assert.equal(listContinuationPrefix("- [ ] todo"), "- [ ] ");
    assert.equal(listContinuationPrefix("- [x] done"), "- [ ] ");
    assert.equal(listContinuationPrefix("  - [X] nested done"), "  - [ ] ");
    assert.equal(listContinuationPrefix("1. [ ] numbered task"), "2. [ ] ");
  });

  test("returns null for non-list lines", () => {
    assert.equal(listContinuationPrefix("plain text"), null);
    assert.equal(listContinuationPrefix("# heading"), null);
    assert.equal(listContinuationPrefix(""), null);
    assert.equal(listContinuationPrefix("   "), null);
    assert.equal(listContinuationPrefix("-no space after marker"), null);
    assert.equal(listContinuationPrefix("> quoted"), null);
  });
});

describe("isEmptyListLine", () => {
  test("identifies lines with only list/task markers", () => {
    assert.equal(isEmptyListLine("- "), true);
    assert.equal(isEmptyListLine("  * "), true);
    assert.equal(isEmptyListLine("1. "), true);
    assert.equal(isEmptyListLine("- [ ] "), true);
    assert.equal(isEmptyListLine("- [x] "), true);
    assert.equal(isEmptyListLine("  - [ ] "), true);
  });

  test("returns false for lines with actual content or non-list text", () => {
    assert.equal(isEmptyListLine("- [ ] task"), false);
    assert.equal(isEmptyListLine("- item text"), false);
    assert.equal(isEmptyListLine("1. first"), false);
    assert.equal(isEmptyListLine("plain text"), false);
    assert.equal(isEmptyListLine(""), false);
  });
});
