import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installFakeDevelopmentCommands } from "./development-test-fixtures.mjs";
import { runScriptUntilStopped } from "./script-test-runner.mjs";

const resetScript = path.resolve("scripts/dev-reset.mjs");

test("development reset refuses a non-development database without deleting persistent state", async () => {
  const sandbox = await createResetSandbox("PRODUCTION");
  try {
    const processOutcome = await runResetScript(sandbox);
    assert.equal(processOutcome.exitCode, 1);
    assert.equal(await readFile(sandbox.assetFile, "utf8"), "preserve me");
    const dockerLog = await readFile(sandbox.dockerLog, "utf8");
    assert.doesNotMatch(dockerLog, /down -v|up -d postgres/);
    assert.match(dockerLog, /start postgres/);
    assert.match(dockerLog, /stop postgres/);
    await assert.rejects(readFile(sandbox.pnpmLog, "utf8"));
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});

test("development reset recreates assets and starts development after a development identity check", async () => {
  const sandbox = await createResetSandbox("DEVELOPMENT");
  try {
    const processOutcome = await runResetScript(sandbox, 1_000);
    assert.equal(processOutcome.exitCode, 143);
    await assert.rejects(readFile(sandbox.assetFile, "utf8"));
    assert.match(await readFile(sandbox.dockerLog, "utf8"), /down -v/);
    assert.match(await readFile(sandbox.pnpmLog, "utf8"), /@gtd-on-rails\/api dev/);
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});

test("development reset refuses a missing PostgreSQL container without starting it", async () => {
  const sandbox = await createResetSandbox("DEVELOPMENT", false);
  try {
    const processOutcome = await runResetScript(sandbox);
    assert.equal(processOutcome.exitCode, 1);
    assert.equal(await readFile(sandbox.assetFile, "utf8"), "preserve me");
    const dockerLog = await readFile(sandbox.dockerLog, "utf8");
    assert.doesNotMatch(dockerLog, /start postgres|up -d postgres|down -v/);
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});

test("development reset restores assets when database recreation fails", async () => {
  const sandbox = await createResetSandbox("DEVELOPMENT", true, "down");
  try {
    const processOutcome = await runResetScript(sandbox);
    assert.equal(processOutcome.exitCode, 1);
    assert.equal(await readFile(sandbox.assetFile, "utf8"), "preserve me");
    assert.match(await readFile(sandbox.dockerLog, "utf8"), /down -v/);
    await assert.rejects(readFile(sandbox.pnpmLog, "utf8"));
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});

async function createResetSandbox(databaseIdentity, postgresExists = true, failedCommand = "") {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtd-reset-test-"));
  const developmentRoot = path.join(directory, "development-data");
  const assetFile = path.join(developmentRoot, "assets", "preserved.txt");
  const dockerLog = path.join(directory, "docker.log");
  const pnpmLog = path.join(directory, "pnpm.log");
  await mkdir(path.dirname(assetFile), { recursive: true });
  await writeFile(assetFile, "preserve me");
  await installFakeDevelopmentCommands(directory);
  return { assetFile, databaseIdentity, developmentRoot, directory, dockerLog, failedCommand, pnpmLog, postgresExists };
}

function runResetScript(sandbox, stopAfter = 0) {
  return runScriptUntilStopped(resetScript, resetEnvironment(sandbox), stopAfter);
}

function resetEnvironment(sandbox) {
  return {
    ...process.env,
    GTD_DEVELOPMENT_ROOT_DIRECTORY: sandbox.developmentRoot,
    GTD_DOCKER_EXECUTABLE: path.join(sandbox.directory, "docker"),
    GTD_PNPM_EXECUTABLE: path.join(sandbox.directory, "pnpm"),
    GTD_TEST_DATABASE_IDENTITY: sandbox.databaseIdentity,
    GTD_TEST_FAILED_DOCKER_COMMAND: sandbox.failedCommand,
    GTD_TEST_POSTGRES_EXISTS: String(sandbox.postgresExists),
    GTD_TEST_DOCKER_LOG: sandbox.dockerLog,
    GTD_TEST_PNPM_LOG: sandbox.pnpmLog,
  };
}
