import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { buildTestPlan, normalizeTestOptions } from "./test-plan.mjs";

test("test options accept sync-server as client alias", () => {
  assert.equal(normalizeTestOptions({ scope: "sync-server" }).scope, "client");
  assert.equal(normalizeTestOptions({ scope: "sync" }).scope, "client");
});

test("default test plan preserves unit integration and e2e stages", () => {
  const plan = buildTestPlan();
  assert.deepEqual(plan.map((step) => step.args.at(-1)), ["unitTest", "integrationTest", "e2e"]);
});

test("desktop unit pattern resolves matching test file", () => {
  const plan = buildTestPlan({
    type: "unit",
    scope: "desktop",
    test: "itemBodyPersistence"
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].executable, process.execPath);
  assert.match(plan[0].args.at(-1), /itemBodyPersistence\.test\.mts$/);
});

test("api unit pattern becomes a Gradle test filter", () => {
  const plan = buildTestPlan({
    type: "unit",
    scope: "api",
    test: "DatabaseSyncServiceTests"
  });

  assert.equal(path.basename(plan[0].cwd), "api");
  assert.deepEqual(plan[0].args, ["unitTest", "--tests", "*DatabaseSyncServiceTests*"]);
});

test("client pattern targets sync-server Gradle tests", () => {
  const plan = buildTestPlan({
    type: "unit",
    scope: "client",
    test: "SnapshotBackupServiceTests"
  });

  assert.equal(path.basename(plan[0].cwd), "sync-server");
  assert.deepEqual(plan[0].args, ["test", "--tests", "*SnapshotBackupServiceTests*"]);
});

test("e2e pattern resolves a Playwright specification", () => {
  const plan = buildTestPlan({
    type: "e2e",
    scope: "desktop",
    test: "vim-normal-mode-keybinds"
  });

  assert.equal(plan[0].args[1], "playwright");
  assert.match(plan[0].args.at(-1), /vim-normal-mode-keybinds\.spec\.ts$/);
});

test("unknown test pattern fails before spawning a command", () => {
  assert.throws(
    () => buildTestPlan({ type: "unit", scope: "desktop", test: "does-not-exist" }),
    /matched no unit tests/
  );
});
