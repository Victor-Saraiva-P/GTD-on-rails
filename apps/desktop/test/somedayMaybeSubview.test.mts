import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { somedayMaybeSubviewTarget } from "../src/features/someday-maybe/somedayMaybeSubview.ts";

describe("somedayMaybeSubviewTarget", () => {
  test("cycles from active to deleted", () => {
    assert.equal(somedayMaybeSubviewTarget("active", "next"), "deleted");
    assert.equal(somedayMaybeSubviewTarget("active", "previous"), "deleted");
  });

  test("cycles from deleted to active", () => {
    assert.equal(somedayMaybeSubviewTarget("deleted", "next"), "active");
    assert.equal(somedayMaybeSubviewTarget("deleted", "previous"), "active");
  });
});
