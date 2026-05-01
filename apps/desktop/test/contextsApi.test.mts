import assert from "node:assert/strict";
import test, { describe, afterEach, mock } from "node:test";

import {
  fetchContexts,
  createContext,
  updateContextName,
  deleteContext,
  updateContextIcon,
  deleteContextIcon,
  fetchContextItems
} from "../src/features/contexts/api.ts";

describe("contexts API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetchContexts maps response and adds iconRevision", async () => {
    const mockResponse = [
      { id: "1", name: "Home", iconUrl: "/assets/home.png" },
      { id: "2", name: "Office" } // no iconUrl
    ];
    
    globalThis.fetch = mock.fn(async () => {
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const contexts = await fetchContexts();
    assert.equal(contexts.length, 2);
    
    assert.equal(contexts[0].id, "1");
    assert.equal(contexts[0].iconUrl, "/assets/home.png");
    assert.ok(contexts[0].iconRevision !== undefined);

    assert.equal(contexts[1].id, "2");
    assert.equal(contexts[1].iconUrl, undefined);
    assert.equal(contexts[1].iconRevision, undefined);
  });

  test("createContext sends POST with name", async () => {
    const mockResponse = { id: "3", name: "New Context" };
    
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({ name: "New Context" }));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const context = await createContext("New Context");
    assert.equal(context.id, "3");
    assert.equal(context.name, "New Context");
  });

  test("updateContextName sends PUT with name", async () => {
    const mockResponse = { id: "4", name: "Updated Context" };
    
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/contexts/4"));
      assert.equal(init?.method, "PUT");
      assert.equal(init?.body, JSON.stringify({ name: "Updated Context" }));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const context = await updateContextName("4", "Updated Context");
    assert.equal(context.name, "Updated Context");
  });

  test("deleteContext sends DELETE method", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/contexts/5"));
      assert.equal(init?.method, "DELETE");
      return new Response("", { status: 200 });
    });

    await deleteContext("5");
  });

  test("updateContextIcon uploads FormData", async () => {
    const mockResponse = { id: "6", name: "Context", iconUrl: "/icon.png" };
    const mockFile = new File(["icon"], "icon.png", { type: "image/png" });

    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/contexts/6/icon"));
      assert.equal(init?.method, "PUT");
      assert.ok(init?.body instanceof FormData);
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const context = await updateContextIcon("6", mockFile);
    assert.equal(context.iconUrl, "/icon.png");
  });

  test("deleteContextIcon sends DELETE method", async () => {
    const mockResponse = { id: "7", name: "Context" };

    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/contexts/7/icon"));
      assert.equal(init?.method, "DELETE");
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const context = await deleteContextIcon("7");
    assert.equal(context.iconUrl, undefined);
  });

  test("fetchContextItems sends correct query params", async () => {
    const mockResponse = [
      { id: "8", title: "Item 1", status: "INBOX" }
    ];

    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().includes("/contexts/9/items?limit=10"));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const items = await fetchContextItems("9", 10);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "8");
  });
});
