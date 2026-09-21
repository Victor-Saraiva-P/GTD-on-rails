import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  developmentEnvironment,
  developmentRootDirectory,
  syncServerDevelopmentRootDirectory
} from "./dev.mjs";

test("development root defaults to repository-local SQLite dataset", () => {
  assert.equal(path.basename(developmentRootDirectory({})), "dev-gtd-on-rails");
});

test("development environment enables the local sync server by default", () => {
  const environment = developmentEnvironment({ PATH: "/tmp" });
  assert.equal(environment.GTD_SYNC_SERVER_ENABLED, "true");
  assert.equal(environment.GTD_SYNC_SERVER_BASE_URL, "http://127.0.0.1:9473");
  assert.equal(environment.GTD_SYNC_SERVER_BIND_ADDRESS, "127.0.0.1");
});

test("sync server development data stays separate from the desktop dataset", () => {
  assert.equal(path.basename(syncServerDevelopmentRootDirectory({})), "dev-gtd-sync-server");
  assert.notEqual(syncServerDevelopmentRootDirectory({}), developmentRootDirectory({}));
});

test("development environment preserves explicit sync settings", () => {
  const environment = developmentEnvironment({
    GTD_SYNC_SERVER_ENABLED: "false",
    GTD_SYNC_SERVER_BASE_URL: "http://100.64.0.2:9473",
    GTD_SYNC_SERVER_DATA_ROOT: "/tmp/custom-sync"
  });
  assert.equal(environment.GTD_SYNC_SERVER_ENABLED, "false");
  assert.equal(environment.GTD_SYNC_SERVER_BASE_URL, "http://100.64.0.2:9473");
  assert.equal(environment.GTD_SYNC_SERVER_DATA_ROOT, "/tmp/custom-sync");
});
