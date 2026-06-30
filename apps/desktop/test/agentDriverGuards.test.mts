import assert from "node:assert/strict";
import test from "node:test";

import { assertDevelopmentRuntime, validateAgentTargetUrl } from "../scripts/agent-driver/server.mjs";

test("agent driver rejects production NODE_ENV", () => {
  assert.throws(
    () => assertDevelopmentRuntime({ NODE_ENV: "production" }),
    /NODE_ENV='production'/
  );
});

test("agent driver rejects production sidecar profile", () => {
  assert.throws(
    () => assertDevelopmentRuntime({ GTD_SIDECAR_PROFILES: "prod,sidecar" }),
    /GTD_SIDECAR_PROFILES containing 'prod'/
  );
});

test("agent driver accepts localhost target URLs", () => {
  assert.equal(validateAgentTargetUrl("http://127.0.0.1:1420"), "http://127.0.0.1:1420/");
  assert.equal(validateAgentTargetUrl("http://localhost:1420"), "http://localhost:1420/");
});

test("agent driver rejects remote target URLs", () => {
  assert.throws(
    () => validateAgentTargetUrl("https://example.com"),
    /expected localhost, 127\.0\.0\.1, or ::1/
  );
});
