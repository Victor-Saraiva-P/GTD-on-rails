import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { developmentEnvironment, developmentRootDirectory } from "./dev.mjs";

test("development root defaults to repository-local SQLite dataset", () => {
  assert.equal(path.basename(developmentRootDirectory({})), "dev-gtd-on-rails");
});

test("development environment disables sync server unless explicitly enabled", () => {
  const environment = developmentEnvironment({ PATH: "/tmp", GTD_SYNC_SERVER_ENABLED: "true" });
  assert.equal(environment.GTD_SYNC_SERVER_ENABLED, "true");
  assert.match(environment.GTD_DATA_ROOT_DIRECTORY, /dev-gtd-on-rails$/);
});
