import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  clientBuildSpec,
  clientDataRoot,
  clientPort,
  clientProcessSpec,
  clientRuntimeEnvironment,
  gtdBuildSpec,
  gtdProcessSpecs,
  gtdRuntimeEnvironment,
  normalizeRuntimeEnvironment
} from "./runtime-config.mjs";

test("runtime environment accepts only dev and staging", () => {
  assert.equal(normalizeRuntimeEnvironment("dev"), "dev");
  assert.equal(normalizeRuntimeEnvironment("staging"), "staging");
  assert.throws(() => normalizeRuntimeEnvironment("prod"), /expected 'dev' or 'staging'/);
});

test("dev GTD runtime uses isolated local data and sync endpoint", () => {
  const environment = gtdRuntimeEnvironment("dev", {});
  assert.equal(path.basename(environment.GTD_DATA_ROOT_DIRECTORY), "dev-gtd-on-rails");
  assert.equal(environment.GTD_DATABASE_ENVIRONMENT, "DEVELOPMENT");
  assert.equal(environment.GTD_SYNC_SERVER_ENABLED, "true");
  assert.equal(environment.GTD_SYNC_SERVER_BASE_URL, "http://127.0.0.1:9473");
});

test("staging GTD runtime uses staging profile, data, and sync endpoint", () => {
  const environment = gtdRuntimeEnvironment("staging", {});
  const specs = gtdProcessSpecs("staging");
  assert.equal(path.basename(environment.GTD_DATA_ROOT_DIRECTORY), "staging-gtd-on-rails");
  assert.equal(environment.GTD_DATABASE_ENVIRONMENT, "STAGING");
  assert.equal(environment.GTD_SYNC_SERVER_BASE_URL, "http://127.0.0.1:9474");
  assert.equal(specs[0].command, "/usr/bin/java");
  assert.equal(specs[0].args[0], "-jar");
  assert.equal(specs[0].args.at(-1), "--spring.profiles.active=staging");
  assert.equal(specs[1].args.at(-1), "dev:staging");
});

test("persistent Java runtimes use built jars instead of Gradle bootRun", () => {
  const apiBuild = gtdBuildSpec();
  const clientBuild = clientBuildSpec();
  const client = clientProcessSpec();

  assert.deepEqual(apiBuild.args, ["--no-daemon", "bootJar"]);
  assert.deepEqual(clientBuild.args, ["--no-daemon", "bootJar"]);
  assert.equal(client.command, "/usr/bin/java");
  assert.equal(client.args[0], "-jar");
  assert.match(client.args[1], /gtd-sync-server\.jar$/);
});

test("sync client data is isolated by runtime environment", () => {
  assert.equal(path.basename(clientDataRoot("dev", {})), "dev-gtd-sync-server");
  assert.equal(path.basename(clientDataRoot("staging", {})), "staging-gtd-sync-server");
  assert.equal(clientPort("dev"), 9473);
  assert.equal(clientPort("staging"), 9474);
  const staging = clientRuntimeEnvironment("staging", {});
  assert.equal(staging.GTD_SYNC_SERVER_PORT, "9474");
  assert.equal(staging.GTD_SYNC_SERVER_PUBLIC_BASE_URL, "http://127.0.0.1:9474");
});
