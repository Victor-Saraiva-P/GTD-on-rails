import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  buildDatabaseReadinessBlockerModel,
  parseReadinessResponse,
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

  test("parses readiness response payload correctly", () => {
    assert.equal(parseReadinessResponse(JSON.stringify({ status: "READY" })), "ready");
    assert.equal(parseReadinessResponse(JSON.stringify({ status: "UPDATE_REQUIRED" })), "update-required");
    assert.equal(parseReadinessResponse(JSON.stringify({ status: "UNAVAILABLE" })), "unavailable");
    assert.equal(parseReadinessResponse("invalid json"), "unavailable");
    assert.equal(parseReadinessResponse(null), "unavailable");
    assert.equal(parseReadinessResponse(undefined), "unavailable");
  });

  test("builds blocker model for update-required state in English", () => {
    const model = buildDatabaseReadinessBlockerModel("update-required");

    assert.equal(model.isBlocked, true);
    assert.equal(model.statusLabel, "UPDATE");
    assert.equal(model.title, "Application update required");
    assert.equal(
      model.message,
      "This installation is incompatible with the shared database schema. An application update is required to continue."
    );
    assert.equal(model.actionText, "Please install the latest application release");
  });

  test("builds blocker model for unavailable state in English", () => {
    const model = buildDatabaseReadinessBlockerModel("unavailable");

    assert.equal(model.isBlocked, true);
    assert.equal(model.statusLabel, "DATABASE");
    assert.equal(model.title, "PostgreSQL unavailable");
    assert.equal(model.message, "Waiting for PostgreSQL to restore authoritative application state.");
  });

  test("builds unblocked model for ready state", () => {
    const model = buildDatabaseReadinessBlockerModel("ready");

    assert.equal(model.isBlocked, false);
  });
});
