import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { assertDisposableDevelopmentRoot } from "./dev-reset.mjs";

test("development reset allows both repository development datasets", () => {
  assert.doesNotThrow(() => assertDisposableDevelopmentRoot(path.resolve("dev-gtd-on-rails")));
  assert.doesNotThrow(() => assertDisposableDevelopmentRoot(path.resolve("dev-gtd-sync-server")));
});

test("development reset refuses arbitrary and production-like paths", () => {
  assert.throws(() => assertDisposableDevelopmentRoot(path.resolve("/tmp/unrelated-gtd")), /invalid/);
  assert.throws(
    () => assertDisposableDevelopmentRoot(
      path.resolve(process.env.HOME ?? "/home/user", "Documents/gtd-on-rails")
    ),
    /invalid/
  );
});
