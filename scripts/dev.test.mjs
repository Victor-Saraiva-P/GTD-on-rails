import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { composeCommand, developmentEnvironment } from "./dev.mjs";

test("development Compose targets only the PostgreSQL service", () => {
  assert.deepEqual(composeCommand(["up", "-d", "postgres"]), [
    "docker", "compose", "-f", path.resolve("infra/compose.yaml"), "up", "-d", "postgres",
  ]);
});

test("development environment uses repository-local persistent files and disables rclone", () => {
  const environment = developmentEnvironment({ EXISTING: "preserved" });
  assert.equal(environment.EXISTING, "preserved");
  assert.equal(environment.GTD_DATA_ROOT_DIRECTORY, path.resolve("dev-gtd-on-rails"));
  assert.equal(environment.GTD_SYNC_RCLONE_ENABLED, "false");
});
