import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { composeCommand, developmentEnvironment } from "./dev.mjs";

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
    await installFakeCommands(sandbox);
    const result = await runDevelopmentScript(sandbox);
    assert.equal(result.exitCode, 143);
    assert.match(await readFile(path.join(sandbox, "docker.log"), "utf8"), /up -d postgres/);
    assert.match(await readFile(path.join(sandbox, "pnpm.log"), "utf8"), /@gtd-on-rails\/api dev/);
    assert.match(await readFile(path.join(sandbox, "pnpm.log"), "utf8"), /@gtd-on-rails\/desktop dev/);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

async function installFakeCommands(sandbox) {
  const fakeDocker = `#!/usr/bin/env node\nconst fs = require("node:fs");\nfs.appendFileSync(process.env.GTD_TEST_LOG, process.argv.slice(2).join(" ") + "\\n");\nif (process.argv.includes("ps")) process.stdout.write("healthy\\n");\n`;
  const fakePnpm = `#!/usr/bin/env node\nconst fs = require("node:fs");\nfs.appendFileSync(process.env.GTD_TEST_PNPM_LOG, process.argv.slice(2).join(" ") + "\\n");\nsetInterval(() => {}, 1000);\n`;
  await writeFile(path.join(sandbox, "docker"), fakeDocker);
  await writeFile(path.join(sandbox, "pnpm"), fakePnpm);
  await chmod(path.join(sandbox, "docker"), 0o755);
  await chmod(path.join(sandbox, "pnpm"), 0o755);
}

function runDevelopmentScript(sandbox) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [devScript], {
      cwd: path.resolve("."),
      env: { ...process.env, PATH: `${sandbox}:${process.env.PATH}`, GTD_TEST_LOG: path.join(sandbox, "docker.log"), GTD_TEST_PNPM_LOG: path.join(sandbox, "pnpm.log") },
      stdio: "ignore",
    });
    const timer = setTimeout(() => child.kill("SIGTERM"), 1000);
    child.once("error", reject);
    child.once("close", (exitCode) => { clearTimeout(timer); resolve({ exitCode }); });
  });
}
