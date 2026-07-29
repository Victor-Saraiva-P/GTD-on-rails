import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { fetchDatabaseReadiness } from "../src/features/database-readiness/api.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetchDatabaseReadiness requests the readiness endpoint", async () => {
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(null, { status: 200 });
  };

  await fetchDatabaseReadiness();

  assert.match(requestedUrl, /\/readiness$/);
});
