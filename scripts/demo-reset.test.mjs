import test from "node:test";
import assert from "node:assert/strict";
import { demoResetUrl, normalizeApiBaseUrl, parseDemoResetArgs, resetDemoData } from "./demo-reset.mjs";

test("parseDemoResetArgs requires explicit confirmation", () => {
  assert.deepEqual(parseDemoResetArgs([]), { confirmed: false });
  assert.deepEqual(parseDemoResetArgs(["--confirm"]), { confirmed: true });
});

test("normalizeApiBaseUrl trims trailing slash", () => {
  assert.equal(normalizeApiBaseUrl("http://127.0.0.1:8080/"), "http://127.0.0.1:8080");
});

test("demoResetUrl points at the dev demo endpoint", () => {
  assert.equal(demoResetUrl("http://127.0.0.1:8080"), "http://127.0.0.1:8080/dev/demo/reset");
});

test("resetDemoData posts to the demo reset endpoint", async () => {
  const calls = [];
  const result = await resetDemoData("http://127.0.0.1:8080", async (url, init) => {
    calls.push({ init, url });
    return { ok: true, json: async () => ({ contextCount: 4, itemCount: 24 }) };
  });

  assert.deepEqual(calls, [{ init: { method: "POST" }, url: "http://127.0.0.1:8080/dev/demo/reset" }]);
  assert.deepEqual(result, { contextCount: 4, itemCount: 24 });
});
