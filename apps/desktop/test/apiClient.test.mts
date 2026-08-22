import assert from "node:assert/strict";
import test, { describe, mock } from "node:test";

import { ApiRequestError, DATABASE_UNAVAILABLE_EVENT, apiFetch, apiJson } from "../src/lib/api/apiClient.ts";

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

test("ApiRequestError extracts ProblemDetail detail property", () => {
  const error = new ApiRequestError(400, '{"title":"Invalid data","detail":"Invalid URL parameter"}');
  assert.equal(error.message, "Invalid URL parameter");
});

test("ApiRequestError extracts JSON message property", () => {
  const error = new ApiRequestError(500, '{"message":"Database connection refused"}');
  assert.equal(error.message, "Database connection refused");
});

describe("apiFetch", () => {
  test("apiFetch succeeds when response is ok", async () => {
    const fetchTransport = mock.fn(async () => {
      return new Response("ok", { status: 200 });
    });

    const response = await apiFetch("/inbox", {}, fetchTransport);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
  });

  test("apiFetch throws ApiRequestError on failure", async () => {
    const fetchTransport = mock.fn(async () => {
      return new Response("Not Found", { status: 404 });
    });

    await assert.rejects(
      async () => {
        await apiFetch("/missing", {}, fetchTransport);
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiRequestError);
        assert.equal(err.status, 404);
        assert.equal(err.responseBody, "Not Found");
        return true;
      }
    );
  });

  test("apiFetch announces a service-unavailable database response", async () => {
    const globalScope = globalThis as { window?: EventTarget };
    const originalWindow = globalScope.window;
    globalScope.window = new EventTarget();
    const unavailable = new Promise<void>((resolve) => {
      window.addEventListener(DATABASE_UNAVAILABLE_EVENT, () => resolve(), { once: true });
    });

    await assert.rejects(apiFetch("/inbox", {}, async () => new Response("Unavailable", { status: 503 })));
    await unavailable;
    globalScope.window = originalWindow;
  });
});

describe("apiJson", () => {
  test("apiJson parses JSON on success", async () => {
    const fetchTransport = mock.fn(async () => {
      return new Response('{"id":"123"}', {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    const data = await apiJson("/inbox", {}, fetchTransport);
    assert.deepEqual(data, { id: "123" });
  });
});
