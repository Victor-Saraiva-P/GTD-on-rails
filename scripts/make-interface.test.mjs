import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("gtd accepts staging as positional environment", async () => {
  const calls = await runMake(["gtd", "staging"]);
  assert.deepEqual(calls, ["scripts/run-gtd.mjs --env=staging"]);
});

test("client defaults to dev and accepts explicit dev", async () => {
  assert.deepEqual(await runMake(["client"]), ["scripts/run-client.mjs --env=dev"]);
  assert.deepEqual(await runMake(["client", "dev"]), ["scripts/run-client.mjs --env=dev"]);
});

test("test selection is positional without executing matching make targets", async () => {
  const calls = await runMake(["test", "unit", "client", "SnapshotBackupServiceTests"]);
  assert.deepEqual(calls, [
    "scripts/test.mjs --type=unit --scope=client --test=SnapshotBackupServiceTests"
  ]);
});

test("short test commands keep positional scope and pattern", async () => {
  const calls = await runMake(["unit", "desktop", "itemBodyPersistence"]);
  assert.deepEqual(calls, [
    "scripts/test.mjs --type=unit --scope=desktop --test=itemBodyPersistence"
  ]);
});

test("check accepts positional scope", async () => {
  const calls = await runMake(["check", "desktop"]);
  assert.deepEqual(calls, ["scripts/test.mjs --type=check --scope=desktop --test="]);
});

async function runMake(goals) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtd-make-"));
  const logPath = path.join(directory, "calls.log");
  await writeNodeStub(directory, logPath);
  const result = spawnSync("make", ["--no-print-directory", ...goals], {
    cwd: root,
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return readCalls(logPath);
}

async function writeNodeStub(directory, logPath) {
  const nodePath = path.join(directory, "node");
  await writeFile(nodePath, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${logPath}"\n`);
  await chmod(nodePath, 0o755);
}

async function readCalls(logPath) {
  try {
    const content = await readFile(logPath, "utf8");
    return content.trim().split("\n").filter(Boolean);
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}
