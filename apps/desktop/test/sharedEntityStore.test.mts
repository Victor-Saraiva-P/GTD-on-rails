import assert from "node:assert/strict";
import test from "node:test";

import {
  getSharedCollectionSnapshot,
  replaceSharedCollection,
  resetSharedEntityStore,
  subscribeSharedCollection,
  upsertSharedEntity
} from "../src/lib/state/sharedEntityStore.ts";

test("shared entity store normalizes entities across collections", () => {
  resetSharedEntityStore();
  replaceSharedCollection("inbox", [{ id: "1", title: "old" }]);
  replaceSharedCollection("project-items", [{ id: "1", title: "old", projectId: "p1" }]);

  upsertSharedEntity({ id: "1", title: "new" });

  assert.equal(getSharedCollectionSnapshot<any>("inbox").items[0].title, "new");
  assert.equal(getSharedCollectionSnapshot<any>("project-items").items[0].title, "new");
  assert.equal(getSharedCollectionSnapshot<any>("project-items").items[0].projectId, "p1");
});

test("shared entity store distinguishes absent and loaded empty collections", () => {
  resetSharedEntityStore();
  assert.equal(getSharedCollectionSnapshot("empty").loaded, false);

  replaceSharedCollection("empty", []);

  assert.equal(getSharedCollectionSnapshot("empty").loaded, true);
  assert.deepEqual(getSharedCollectionSnapshot("empty").items, []);
});

test("lightweight list refresh preserves an already loaded item body", () => {
  resetSharedEntityStore();
  const body = { text: "loaded", inlineMarks: [], lineBlocks: [], blockEntities: [] };
  replaceSharedCollection("inbox", [{ id: "1", title: "one", body, bodyLoaded: true }]);

  replaceSharedCollection("inbox", [{
    id: "1",
    title: "renamed remotely",
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    bodyLoaded: false
  }]);

  const item = getSharedCollectionSnapshot<any>("inbox").items[0];
  assert.equal(item.title, "renamed remotely");
  assert.equal(item.bodyLoaded, true);
  assert.equal(item.body.text, "loaded");
});

test("shared entity store stops refreshing collections after membership removal", () => {
  resetSharedEntityStore();
  replaceSharedCollection("inbox", [{ id: "1", title: "one" }]);
  replaceSharedCollection("project", [{ id: "1", title: "one" }]);
  replaceSharedCollection("project", []);

  const projectVersion = getSharedCollectionSnapshot<any>("project").version;
  upsertSharedEntity({ id: "1", title: "two" });

  assert.equal(getSharedCollectionSnapshot<any>("inbox").items[0].title, "two");
  assert.equal(getSharedCollectionSnapshot<any>("project").version, projectVersion);
  assert.deepEqual(getSharedCollectionSnapshot<any>("project").items, []);
});

test("shared entity store notifies collection subscribers", () => {
  resetSharedEntityStore();
  let notifications = 0;
  const unsubscribe = subscribeSharedCollection("inbox", () => {
    notifications += 1;
  });

  replaceSharedCollection("inbox", [{ id: "1", title: "one" }]);
  upsertSharedEntity({ id: "1", title: "two" });
  unsubscribe();

  assert.equal(notifications, 2);
});
