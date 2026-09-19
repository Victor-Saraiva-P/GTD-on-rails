import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { applyVimInsertEscape } from "../src/features/inbox/cmVimKeymaps.ts";

describe("vimInsertEscape", () => {
  test("applies jk insert escape mapping cleanly", () => {
    assert.doesNotThrow(() => {
      applyVimInsertEscape("jk");
    });
  });

  test("is idempotent when called repeatedly with same sequence", () => {
    assert.doesNotThrow(() => {
      applyVimInsertEscape("jk");
      applyVimInsertEscape("jk");
    });
  });

  test("handles sequence change and unmap smoothly", () => {
    assert.doesNotThrow(() => {
      applyVimInsertEscape("jj");
      applyVimInsertEscape("jk");
    });
  });
});
