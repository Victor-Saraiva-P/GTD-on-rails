import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureGtdDataRoot } from "./run-gtd.mjs";
import { gtdRuntimeEnvironment } from "./runtime-config.mjs";

test("make dev creates its SQLite parent directory in a new checkout", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "gtd-dev-data-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const environment = gtdRuntimeEnvironment("dev", {
    GTD_DEVELOPMENT_ROOT_DIRECTORY: path.join(temporary, "nested", "dev-gtd-on-rails")
  });
  await ensureGtdDataRoot(environment.GTD_DATA_ROOT_DIRECTORY);
  const info = await stat(environment.GTD_DATA_ROOT_DIRECTORY);
  assert.equal(info.isDirectory(), true);
  assert.equal(info.mode & 0o077, 0, "new personal data directories should not allow group or other access");
  assert.deepEqual(await readdir(environment.GTD_DATA_ROOT_DIRECTORY), []);
});

test("preparing a data root repeatedly preserves existing database files", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "gtd-existing-db-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, "dev-gtd-on-rails");
  await ensureGtdDataRoot(root);
  await writeFile(path.join(root, "gtd.db"), "existing SQLite bytes");
  await ensureGtdDataRoot(root);
  assert.equal(await readFile(path.join(root, "gtd.db"), "utf8"), "existing SQLite bytes");
});

test("preparation fails with a useful path if the configured root is not a directory", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "gtd-invalid-root-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const file = path.join(temporary, "file");
  await writeFile(file, "not a directory");
  await assert.rejects(
    ensureGtdDataRoot(path.join(file, "dev-gtd-on-rails")),
    /Cannot prepare GTD data directory.*dev-gtd-on-rails/
  );
});
