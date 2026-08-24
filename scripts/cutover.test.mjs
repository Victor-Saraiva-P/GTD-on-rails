import test from "node:test";
import assert from "node:assert/strict";
import { cutoverCommand, cutoverEnvironment, runCutover } from "./cutover.mjs";

test("cutover environment requires production identity and cutover profile", () => {
  const environment = cutoverEnvironment({
    GTD_DATA_ROOT_DIRECTORY: "/tmp/gtd-prod",
  });

  assert.equal(environment.GTD_DATA_ROOT_DIRECTORY, "/tmp/gtd-prod");
  assert.equal(environment.GTD_SIDECAR_PROFILES, "prod,cutover");
  assert.equal(environment.GTD_DATABASE_ENVIRONMENT, "PRODUCTION");
});

test("cutover command runs api bootJar and starts cutover sidecar", () => {
  assert.deepEqual(cutoverCommand(), ["--filter", "@gtd-on-rails/api", "run", "bootJar"]);
});

test("runCutover builds jar and launches cutover process", () => {
  const calls = [];
  runCutover({ TEST: "cutover" }, (...args) => {
    calls.push(args);
    return { status: 0 };
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0][1], cutoverCommand());
  assert.equal(calls[1][0], "java");
  assert.match(calls[1][1][0], /-jar/);
});
