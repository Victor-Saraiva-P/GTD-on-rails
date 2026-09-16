import assert from "node:assert/strict";
import test, { describe, afterEach, mock } from "node:test";

import {
  fetchSomedayMaybeItems,
  fetchDeletedSomedayMaybeItems,
  revertSomedayMaybeToStuff,
  deleteSomedayMaybeItem,
  restoreSomedayMaybeItem,
  updateSomedayMaybeTitle,
  updateSomedayMaybeBody,
  assignSomedayMaybeProject
} from "../src/features/someday-maybe/api.ts";
import type { SomedayMaybeItem } from "../src/features/someday-maybe/types.ts";

describe("someday-maybe API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const dummyItem: SomedayMaybeItem = {
    id: "item-1",
    title: "Learn Rust",
    body: { text: "Some notes", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    status: "SOMEDAY_MAYBE",
    createdAt: "2026-05-01T00:00:00Z",
    projectId: null,
    projectTitle: null
  };

  test("fetchSomedayMaybeItems returns mapped someday/maybe items", async () => {
    const mockResponse = [
      { id: "1", title: "Learn Rust", body: "", status: "SOMEDAY_MAYBE", createdAt: "2026-05-01T00:00:00Z" }
    ];

    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/someday-maybe"));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const items = await fetchSomedayMaybeItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "1");
    assert.equal(items[0].status, "SOMEDAY_MAYBE");
    assert.deepEqual(items[0].body, { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] });
  });

  test("fetchDeletedSomedayMaybeItems calls /someday-maybe/deleted", async () => {
    const mockResponse = [
      { id: "1", title: "Deleted Item", body: null, status: "SOMEDAY_MAYBE", createdAt: "2026-05-01T00:00:00Z" }
    ];

    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/someday-maybe/deleted"));
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const items = await fetchDeletedSomedayMaybeItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "1");
    assert.deepEqual(items[0].body, { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] });
  });

  test("revertSomedayMaybeToStuff calls POST /someday-maybe/:id/stuff", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/someday-maybe/item-1/stuff"));
      assert.equal(init?.method, "POST");
      return new Response(null, { status: 200 });
    });

    await revertSomedayMaybeToStuff("item-1");
  });

  test("deleteSomedayMaybeItem calls DELETE /items/:id", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/item-1"));
      assert.equal(init?.method, "DELETE");
      return new Response(null, { status: 204 });
    });

    await deleteSomedayMaybeItem("item-1");
  });

  test("restoreSomedayMaybeItem calls POST /items/:id/restore", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/item-1/restore"));
      assert.equal(init?.method, "POST");
      return new Response(null, { status: 200 });
    });

    await restoreSomedayMaybeItem("item-1");
  });

  test("updateSomedayMaybeTitle calls PATCH /items/:id/title", async () => {
    const mockResponse = { id: "item-1", title: "New Title", body: "", status: "SOMEDAY_MAYBE" };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/item-1/title"));
      assert.equal(init?.method, "PATCH");
      const body = JSON.parse(init?.body as string);
      assert.equal(body.title, "New Title");
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const updated = await updateSomedayMaybeTitle(dummyItem, "New Title");
    assert.equal(updated.title, "New Title");
  });

  test("updateSomedayMaybeBody calls PATCH /items/:id/body", async () => {
    const nextBody = { text: "Updated body", inlineMarks: [], lineBlocks: [], blockEntities: [] };
    const mockResponse = { id: "item-1", title: "Learn Rust", body: nextBody, status: "SOMEDAY_MAYBE" };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/item-1/body"));
      assert.equal(init?.method, "PATCH");
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const updated = await updateSomedayMaybeBody(dummyItem, nextBody);
    assert.equal(updated.body.text, "Updated body");
  });

  test("assignSomedayMaybeProject calls PUT /items/:id/project", async () => {
    const mockResponse = { id: "item-1", title: "Learn Rust", body: "", status: "SOMEDAY_MAYBE", projectId: "proj-1" };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/item-1/project"));
      assert.equal(init?.method, "PUT");
      const body = JSON.parse(init?.body as string);
      assert.equal(body.projectId, "proj-1");
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const updated = await assignSomedayMaybeProject(dummyItem, "proj-1");
    assert.equal(updated.projectId, "proj-1");
  });
});
