import assert from "node:assert/strict";
import test from "node:test";

import { mutateSharedEntityOptimistically } from "../src/lib/state/optimisticSharedEntity.ts";
import {
  getSharedCollectionSnapshot,
  isSharedEntityPending,
  replaceSharedCollection,
  resetSharedEntityStore
} from "../src/lib/state/sharedEntityStore.ts";

test("optimistic shared entity mutation updates cached collections before persistence resolves", async () => {
  resetSharedEntityStore();
  const snapshot = { id: "1", title: "old", body: "body" };
  replaceSharedCollection("inbox", [snapshot]);
  replaceSharedCollection("project", [{ ...snapshot, projectId: "p1" }]);

  const mutation = mutateSharedEntityOptimistically(
    snapshot,
    { ...snapshot, title: "local" },
    async () => ({ id: "1", title: "server", body: "body" })
  );

  assert.equal(getSharedCollectionSnapshot<any>("inbox").items[0].title, "local");
  assert.equal(getSharedCollectionSnapshot<any>("project").items[0].title, "local");

  const persisted = await mutation;
  assert.equal(persisted.title, "server");
  assert.equal(getSharedCollectionSnapshot<any>("inbox").items[0].title, "server");
  assert.equal(getSharedCollectionSnapshot<any>("project").items[0].projectId, "p1");
});

test("remote revalidation cannot overwrite fields with an in-flight local mutation", async () => {
  resetSharedEntityStore();
  const snapshot = { id: "1", title: "old", body: "old body", revision: 1 };
  replaceSharedCollection("inbox", [snapshot]);

  let resolvePersist!: (value: typeof snapshot) => void;
  const persist = new Promise<typeof snapshot>((resolve) => {
    resolvePersist = resolve;
  });
  const mutation = mutateSharedEntityOptimistically(
    snapshot,
    { ...snapshot, title: "local" },
    () => persist
  );

  assert.equal(isSharedEntityPending("1"), true);
  replaceSharedCollection("inbox", [{ id: "1", title: "stale server", body: "remote body", revision: 2 }]);

  const pending = getSharedCollectionSnapshot<any>("inbox").items[0];
  assert.equal(pending.title, "local");
  assert.equal(pending.body, "remote body");
  assert.equal(pending.revision, 2);

  resolvePersist({ id: "1", title: "persisted", body: "remote body", revision: 3 });
  await mutation;

  assert.equal(isSharedEntityPending("1"), false);
  assert.equal(getSharedCollectionSnapshot<any>("inbox").items[0].title, "persisted");
});

test("rollback restores only locally changed fields and keeps unrelated remote updates", async () => {
  resetSharedEntityStore();
  const snapshot = { id: "1", title: "old", body: "old body" };
  replaceSharedCollection("inbox", [snapshot]);

  let rejectPersist!: (error: Error) => void;
  const persist = new Promise<typeof snapshot>((_resolve, reject) => {
    rejectPersist = reject;
  });
  const mutation = mutateSharedEntityOptimistically(
    snapshot,
    { ...snapshot, title: "local" },
    () => persist
  );

  replaceSharedCollection("inbox", [{ id: "1", title: "stale server", body: "remote body" }]);
  rejectPersist(new Error("save failed"));

  await assert.rejects(mutation, /save failed/);
  const restored = getSharedCollectionSnapshot<any>("inbox").items[0];
  assert.equal(restored.title, "old");
  assert.equal(restored.body, "remote body");
  assert.equal(isSharedEntityPending("1"), false);
});

test("newer optimistic mutation survives completion of an older mutation", async () => {
  resetSharedEntityStore();
  const snapshot = { id: "1", title: "old" };
  replaceSharedCollection("inbox", [snapshot]);

  let resolveFirst!: (value: typeof snapshot) => void;
  const firstPersist = new Promise<typeof snapshot>((resolve) => {
    resolveFirst = resolve;
  });
  let rejectSecond!: (error: Error) => void;
  const secondPersist = new Promise<typeof snapshot>((_resolve, reject) => {
    rejectSecond = reject;
  });

  const first = mutateSharedEntityOptimistically(
    snapshot,
    { ...snapshot, title: "first" },
    () => firstPersist
  );
  const second = mutateSharedEntityOptimistically(
    snapshot,
    { ...snapshot, title: "second" },
    () => secondPersist
  );

  resolveFirst({ id: "1", title: "first" });
  await first;
  assert.equal(getSharedCollectionSnapshot<any>("inbox").items[0].title, "second");

  rejectSecond(new Error("second failed"));
  await assert.rejects(second, /second failed/);
  assert.equal(getSharedCollectionSnapshot<any>("inbox").items[0].title, "first");
});

test("optimistic shared entity mutation restores the previous entity on failure", async () => {
  resetSharedEntityStore();
  const snapshot = { id: "1", title: "old" };
  replaceSharedCollection("inbox", [snapshot]);

  await assert.rejects(
    mutateSharedEntityOptimistically(
      snapshot,
      { ...snapshot, title: "local" },
      async () => {
        throw new Error("save failed");
      }
    ),
    /save failed/
  );

  assert.equal(getSharedCollectionSnapshot<any>("inbox").items[0].title, "old");
});
