import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { readAppVersion, syncAppVersion, validateAppVersion } from "./sync-version.mjs";

test("validateAppVersion accepts numeric semantic versions", () => {
  assert.equal(validateAppVersion("1.2.3\n"), "1.2.3");
});

test("validateAppVersion rejects non-numeric versions", () => {
  assert.throws(() => validateAppVersion("v1.2.3"), /expected semantic version/);
});

test("readAppVersion reads the root VERSION value", async () => {
  const repoRoot = await createVersionFixture("2.3.4");
  assert.equal(await readAppVersion(repoRoot), "2.3.4");
});

test("syncAppVersion updates every app version target", async () => {
  const repoRoot = await createVersionFixture("2.3.4");
  await syncAppVersion(repoRoot, "sync");
  assert.match(await readFixture(repoRoot, "apps/desktop/package.json"), /"version": "2.3.4"/);
  assert.match(await readFixture(repoRoot, "apps/api/build.gradle"), /version = '2.3.4'/);
  assert.match(await readFixture(repoRoot, "apps/desktop/src-tauri/Cargo.lock"), /name = "desktop"\nversion = "2.3.4"/);
  assert.match(await readFixture(repoRoot, "apps/desktop/src/config/appMetadata.ts"), /version: "2.3.4"/);
  assert.match(await readFixture(repoRoot, "apps/desktop/package.json"), /api-2.3.4.jar/);
});

test("syncAppVersion check fails when targets drift", async () => {
  const repoRoot = await createVersionFixture("2.3.4");
  await assert.rejects(() => syncAppVersion(repoRoot, "check"), /version targets are out of sync/);
});

async function createVersionFixture(version) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "gtd-version-"));
  await writeFixture(repoRoot, "VERSION", `${version}\n`);
  await writeFixture(repoRoot, "apps/desktop/package.json", desktopPackageJson());
  await writeFixture(repoRoot, "apps/api/package.json", apiPackageJson());
  await writeFixture(repoRoot, "apps/api/build.gradle", "version = '1.1.3'\n");
  await writeFixture(repoRoot, "apps/desktop/src-tauri/tauri.conf.json", '{\n  "version": "1.1.3"\n}\n');
  await writeFixture(repoRoot, "apps/desktop/src-tauri/Cargo.toml", '[package]\nversion = "1.1.3"\n');
  await writeFixture(repoRoot, "apps/desktop/src-tauri/Cargo.lock", 'name = "desktop"\nversion = "1.1.3"\n');
  await writeFixture(repoRoot, "apps/desktop/src/config/appMetadata.ts", 'version: "1.1.2"\n');
  return repoRoot;
}

async function writeFixture(repoRoot, relativePath, content) {
  const filePath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

async function readFixture(repoRoot, relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function desktopPackageJson() {
  return JSON.stringify({
    version: "1.1.3",
    scripts: { "build:sidecar": "cp ../api/build/libs/api-1.1.3.jar src-tauri/binaries/gtd-api.jar" },
  });
}

function apiPackageJson() {
  return JSON.stringify({ version: "1.1.3" });
}
