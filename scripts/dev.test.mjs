import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { composeCommand, developmentEnvironment } from "./dev.mjs";
import { installFakeDevelopmentCommands } from "./development-test-fixtures.mjs";
import { runScriptUntilStopped } from "./script-test-runner.mjs";

const devScript = path.resolve("scripts/dev.mjs");

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

test("development orchestrator starts Compose and both native processes", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "gtd-dev-test-"));
  try {
    const assetFile = await createDevelopmentAsset(sandbox);
    await installFakeDevelopmentCommands(sandbox);
    const processOutcome = await runDevelopmentScript(sandbox, path.dirname(path.dirname(assetFile)));
    assert.equal(processOutcome.exitCode, 143);
    assert.equal(await readFile(assetFile, "utf8"), "preserve me");
    assert.match(await readFile(path.join(sandbox, "docker.log"), "utf8"), /up -d postgres/);
    assert.doesNotMatch(await readFile(path.join(sandbox, "docker.log"), "utf8"), /down -v/);
    assert.match(await readFile(path.join(sandbox, "pnpm.log"), "utf8"), /@gtd-on-rails\/api dev/);
    assert.match(await readFile(path.join(sandbox, "pnpm.log"), "utf8"), /@gtd-on-rails\/desktop dev/);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

async function createDevelopmentAsset(sandbox) {
  const assetFile = path.join(sandbox, "development-data", "assets", "preserved.txt");
  await mkdir(path.dirname(assetFile), { recursive: true });
  await writeFile(assetFile, "preserve me");
  return assetFile;
}

function runDevelopmentScript(sandbox, developmentRoot) {
  return runScriptUntilStopped(devScript, developmentScriptEnvironment(sandbox, developmentRoot), 1_000);
}

function developmentScriptEnvironment(sandbox, developmentRoot) {
  return { ...process.env, GTD_DEVELOPMENT_ROOT_DIRECTORY: developmentRoot, GTD_DOCKER_EXECUTABLE: path.join(sandbox, "docker"), GTD_PNPM_EXECUTABLE: path.join(sandbox, "pnpm"), GTD_TEST_LOG: path.join(sandbox, "docker.log"), GTD_TEST_PNPM_LOG: path.join(sandbox, "pnpm.log") };
}
