import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach, mock } from "node:test";

import { ApiRequestError, apiFetch, apiJson } from "../src/lib/api/apiClient.ts";

test("ApiRequestError exposes status and responseBody", () => {
  const error = new ApiRequestError(404, '{"error":"Not Found"}');
  assert.equal(error.status, 404);
  assert.equal(error.responseBody, '{"error":"Not Found"}');
  assert.equal(error.message, "API request failed with status 404");
  assert.equal(error.name, "ApiRequestError");
});

test("ApiRequestError respects custom message", () => {
  const error = new ApiRequestError(500, "", "Custom error message");
  assert.equal(error.message, "Custom error message");
});

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("apiFetch succeeds when response is ok", async () => {
    globalThis.fetch = mock.fn(async () => {
      return new Response("ok", { status: 200 });
    });

    const response = await apiFetch("/inbox");
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
  });

  test("apiFetch throws ApiRequestError on failure", async () => {
    globalThis.fetch = mock.fn(async () => {
      return new Response("Not Found", { status: 404 });
    });

    await assert.rejects(
      async () => {
        await apiFetch("/missing");
      },
      (err: any) => {
        assert.ok(err instanceof ApiRequestError);
        assert.equal(err.status, 404);
        assert.equal(err.responseBody, "Not Found");
        return true;
      }
    );
  });
});

describe("apiJson", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("apiJson parses JSON on success", async () => {
    globalThis.fetch = mock.fn(async () => {
      return new Response('{"id":"123"}', { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const data = await apiJson("/inbox");
    assert.deepEqual(data, { id: "123" });
  });
});

