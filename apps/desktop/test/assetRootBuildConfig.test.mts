import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));

test("production asset previews use the normal user data directory", () => {
  const environment = loadEnv("production", desktopRoot, "VITE_");
  assert.equal(environment.VITE_DATA_ROOT_DIRECTORY_NAME, "gtd-on-rails");
});

test("staging builds keep asset previews inside the staging data directory", async () => {
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(packageJson, /"desktop:build:staging": "VITE_DATA_ROOT_DIRECTORY_NAME=staging-gtd-on-rails/);
  assert.match(packageJson, /"desktop:build:staging-reset": "VITE_DATA_ROOT_DIRECTORY_NAME=staging-gtd-on-rails/);
});
