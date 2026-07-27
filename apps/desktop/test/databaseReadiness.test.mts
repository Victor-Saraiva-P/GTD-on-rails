import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  shouldBlockDatabaseInteraction,
  shouldReloadAfterDatabaseRecovery
} from "../src/features/database-readiness/databaseReadiness.ts";

describe("database readiness", () => {
  test("blocks interaction when a readiness poll or an API request finds PostgreSQL unavailable", () => {
    assert.equal(shouldBlockDatabaseInteraction(false, false), true);
    assert.equal(shouldBlockDatabaseInteraction(true, true), true);
    assert.equal(shouldBlockDatabaseInteraction(true, false), false);
  });

  test("reloads authoritative application state only after blocked PostgreSQL recovers", () => {
    assert.equal(shouldReloadAfterDatabaseRecovery(true, true), true);
    assert.equal(shouldReloadAfterDatabaseRecovery(true, false), false);
    assert.equal(shouldReloadAfterDatabaseRecovery(false, true), false);
  });
});
