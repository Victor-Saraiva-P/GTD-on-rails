import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildStaging, launchStaging, stagingCommand, stagingEnvironment, stagingRootDirectory } from "./staging.mjs";
import { buildStagingReset, launchStagingReset, stagingResetCommand, stagingResetEnvironment } from "./staging-reset.mjs";

test("staging uses a repository-local persistent root by default", () => {
  assert.equal(stagingRootDirectory({}), path.resolve("staging-gtd-on-rails"));
});

test("staging environment isolates File Sync and never inherits production defaults", () => {
  const environment = stagingEnvironment({
    GTD_STAGING_ROOT_DIRECTORY: "/tmp/gtd-staging",
    GTD_SIDECAR_PROFILES: "prod,sidecar",
    GTD_DATABASE_ENVIRONMENT: "PRODUCTION",
    GTD_SYNC_RCLONE_ENABLED: "false",
    GTD_SYNC_RCLONE_REMOTE: undefined,
  });

  assert.equal(environment.GTD_DATA_ROOT_DIRECTORY, "/tmp/gtd-staging");
  assert.equal(environment.GTD_SIDECAR_PROFILES, "staging,sidecar");
  assert.equal(environment.GTD_DATABASE_ENVIRONMENT, "STAGING");
  assert.equal(environment.GTD_SYNC_RCLONE_ENABLED, "true");
  assert.equal(environment.GTD_SYNC_RCLONE_REMOTE, "gdrive:staging-gtd-on-rails");
});

test("staging build command selects the staging desktop workflow", () => {
  assert.deepEqual(stagingCommand(), ["--filter", "@gtd-on-rails/desktop", "desktop:build:staging"]);
});

test("buildStaging runs the isolated desktop build", () => {
  const calls = [];
  buildStaging({ TEST: "staging" }, (...argumentsList) => {
    calls.push(argumentsList);
    return { status: 0 };
  });

  assert.equal(calls[0][0], "/usr/bin/pnpm");
  assert.deepEqual(calls[0][1], stagingCommand());
  assert.equal(calls[0][2].env.TEST, "staging");
});

test("launchStaging starts the packaged desktop executable", () => {
  const calls = [];
  const child = { once() {} };
  assert.equal(launchStaging({ TEST: "staging" }, (...argumentsList) => {
    calls.push(argumentsList);
    return child;
  }), child);

  assert.match(calls[0][0], /apps\/desktop\/src-tauri\/target\/release\/desktop$/);
  assert.equal(calls[0][2].env.TEST, "staging");
});

test("staging reset requires the staging profile and identity", () => {
  const environment = stagingResetEnvironment({ GTD_STAGING_ROOT_DIRECTORY: "/tmp/gtd-staging" });

  assert.equal(environment.GTD_DATA_ROOT_DIRECTORY, "/tmp/gtd-staging");
  assert.equal(environment.GTD_SIDECAR_PROFILES, "staging,sidecar,staging-reset");
  assert.equal(environment.GTD_DATABASE_ENVIRONMENT, "STAGING");
  assert.equal(environment.GTD_STAGING_RESET, "true");
  assert.equal(environment.GTD_SYNC_RCLONE_ENABLED, "true");
});

test("staging reset builds and launches the reset desktop workflow", () => {
  const buildCalls = [];
  buildStagingReset({ TEST: "reset" }, (...argumentsList) => {
    buildCalls.push(argumentsList);
    return { status: 0 };
  });
  assert.deepEqual(buildCalls[0][1], stagingResetCommand());

  const launchCalls = [];
  const child = { once() {} };
  assert.equal(launchStagingReset({ TEST: "reset" }, (...argumentsList) => {
    launchCalls.push(argumentsList);
    return child;
  }), child);
  assert.equal(launchCalls[0][2].env.TEST, "reset");
});
