import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertStagingSyncUrl,
  clientBuildSpec,
  clientDataRoot,
  clientPort,
  clientProcessSpec,
  clientRuntimeEnvironment,
  gtdBuildSpec,
  gtdProcessSpecs,
  gtdRuntimeEnvironment,
  normalizeRuntimeEnvironment,
  resolvePnpmExecutable
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
  assert.equal(environment.PATH.split(path.delimiter)[0], path.dirname(process.execPath));
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

test("staging rejects the production sync endpoint", () => {
  const production = "https://sync.example.test:9475";
  assert.throws(
    () => gtdRuntimeEnvironment("staging", {
      GTD_SYNC_SERVER_BASE_URL: production,
      GTD_PRODUCTION_SYNC_SERVER_BASE_URL: production
    }), /isolated non-production endpoint/
  );
  assert.throws(() => assertStagingSyncUrl("http://127.0.0.1:9475", {}), /isolated/);
  assert.doesNotThrow(() => assertStagingSyncUrl("https://sync.example.test:9476", {
    GTD_PRODUCTION_SYNC_SERVER_BASE_URL: production
  }));
});

test("desktop runtime resolves pnpm installed in the invoking user's PATH", async (t) => {
  const bin = await mkdtemp(path.join(os.tmpdir(), "gtd-pnpm-"));
  t.after(() => rm(bin, { recursive: true, force: true }));
  const executable = path.join(bin, "pnpm");
  await writeFile(executable, "#!/bin/sh\nexit 0\n");
  await chmod(executable, 0o755);
  const environment = { PATH: `${bin}:/usr/bin` };
  assert.equal(resolvePnpmExecutable(environment), executable);
  assert.equal(gtdProcessSpecs("dev", environment)[1].command, executable);
  assert.ok(gtdRuntimeEnvironment("dev", environment).PATH.split(path.delimiter).includes(bin));
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
  assert.equal(staging.GTD_SYNC_SERVER_DEPLOYMENT_ENVIRONMENT, "staging");
  assert.equal(staging.GTD_GOOGLE_CALENDAR_PROJECTION_ENABLED, "false");
  assert.equal(staging.GTD_SYNC_SERVER_GOOGLE_CALLBACK_LISTENER_ENABLED, "false");
  assert.equal(staging.GTD_CLIENT_AUTO_UPDATE_ENABLED, "false");
});
