import assert from "node:assert/strict";
import test, { describe, afterEach, mock } from "node:test";

import {
  fetchInboxStuffs,
  createStuff,
  deleteStuff,
  updateStuffTitle,
  updateStuffBody
} from "../src/features/inbox/api.ts";
import type { Stuff, Body } from "../src/features/inbox/types.ts";

describe("inbox API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const dummyBody: Body = {
    version: 1,
    blocks: [{ id: "1", type: "paragraph", properties: { richText: [{ text: "Details" }] } }]
  };

  test("fetchInboxStuffs returns mapped stuff array", async () => {
    const mockResponse = [
      { id: "1", title: "Task 1", body: null, status: "INBOX", createdAt: "2026-05-01T00:00:00Z" }
    ];
    
    globalThis.fetch = mock.fn(async () => {
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const stuffs = await fetchInboxStuffs();
    assert.equal(stuffs.length, 1);
    assert.equal(stuffs[0].id, "1");
  });

  test("createStuff sends correct payload", async () => {
    const mockResponse = { id: "2", title: "New Task", body: dummyBody, status: "INBOX", createdAt: "2026-05-01T00:00:00Z" };
    
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({ title: "New Task", body: dummyBody }));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const stuff = await createStuff("New Task", dummyBody);
    assert.equal(stuff.id, "2");
  });

  test("deleteStuff sends DELETE method", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/123"));
      assert.equal(init?.method, "DELETE");
      return new Response("", { status: 200 });
    });

    await deleteStuff("123");
  });

  test("updateStuffTitle only changes title", async () => {
    const item: Stuff = { id: "3", title: "Old Title", body: dummyBody, status: "INBOX", createdAt: "2026-05-01T00:00:00Z" };
    const mockResponse = { ...item, title: "New Title" };

    globalThis.fetch = mock.fn(async (input, init) => {
      assert.equal(init?.method, "PUT");
      assert.equal(init?.body, JSON.stringify({ title: "New Title", body: dummyBody }));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const updated = await updateStuffTitle(item, "New Title");
    assert.equal(updated.title, "New Title");
    assert.deepEqual(updated.body, dummyBody);
  });

  test("updateStuffBody only changes body", async () => {
    const item: Stuff = { id: "4", title: "Title", body: null, status: "INBOX", createdAt: "2026-05-01T00:00:00Z" };
    const mockResponse = { ...item, body: dummyBody };

    globalThis.fetch = mock.fn(async (input, init) => {
      assert.equal(init?.method, "PUT");
      assert.equal(init?.body, JSON.stringify({ title: "Title", body: dummyBody }));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const updated = await updateStuffBody(item, dummyBody);
    assert.equal(updated.title, "Title");
    assert.deepEqual(updated.body, dummyBody);
  });
});
