import assert from "node:assert/strict";
import test, { describe, afterEach, mock } from "node:test";
import { fetchGoogleCalendarStatus, saveGoogleCredentials, getAuthUrl } from "../src/features/integrations/googleCalendarApi.ts";

describe("googleCalendarApi", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetchGoogleCalendarStatus returns status object", async () => {
    const mockResponse = { credentialsConfigured: true, connected: false, calendars: [] };
    
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/integrations/google-calendar/status"));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const status = await fetchGoogleCalendarStatus();
    assert.equal(status.credentialsConfigured, true);
    assert.equal(status.connected, false);
  });

  test("saveGoogleCredentials sends correct payload", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.equal(init?.method, "POST");
      assert.ok(input.toString().endsWith("/integrations/google-calendar/credentials"));
      assert.equal(init?.body, JSON.stringify({ clientId: "id", clientSecret: "secret" }));
      return new Response(null, { status: 200 });
    });

    await saveGoogleCredentials("id", "secret");
  });

  test("getAuthUrl returns auth url", async () => {
    const mockResponse = { url: "https://accounts.google.com/o/oauth2/v2/auth" };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.equal(init?.method, "POST");
      assert.ok(input.toString().endsWith("/integrations/google-calendar/auth-url"));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const result = await getAuthUrl();
    assert.equal(result.url, "https://accounts.google.com/o/oauth2/v2/auth");
  });
});
