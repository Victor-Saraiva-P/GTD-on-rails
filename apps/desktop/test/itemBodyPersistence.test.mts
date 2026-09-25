import assert from "node:assert/strict";
import test from "node:test";

import { createItemBodyPersistenceQueue } from "../src/features/inbox/itemBodyPersistence.ts";
import type { ItemBody } from "../src/features/inbox/types.ts";

test("persistence queue coalesces rapid editor snapshots", async () => {
  const savedBodies: string[] = [];
  const queue = createItemBodyPersistenceQueue({
    debounceMs: 5,
    persist: async (body) => {
      savedBodies.push(body.text);
    }
  });

  queue.queue(body("first"));
  queue.queue(body("second"));
  await delay(20);

  assert.deepEqual(savedBodies, ["second"]);
});

test("persistence queue keeps storage work off the editing path", async () => {
  const firstSave = deferred();
  const savedBodies: string[] = [];
  let activeSaves = 0;
  let maxActiveSaves = 0;
  const queue = createItemBodyPersistenceQueue({
    debounceMs: 0,
    persist: async (snapshot) => {
      savedBodies.push(snapshot.text);
      activeSaves += 1;
      maxActiveSaves = Math.max(maxActiveSaves, activeSaves);
      if (snapshot.text === "first") await firstSave.promise;
      activeSaves -= 1;
    }
  });

  queue.queue(body("first"));
  await delay(5);
  queue.queue(body("second"));
  await delay(5);
  firstSave.resolve();
  await queue.flush();

  assert.deepEqual(savedBodies, ["first", "second"]);
  assert.equal(maxActiveSaves, 1);
});

test("flush persists the latest snapshot without waiting for debounce", async () => {
  const savedBodies: string[] = [];
  const queue = createItemBodyPersistenceQueue({
    debounceMs: 60_000,
    persist: async (snapshot) => {
      savedBodies.push(snapshot.text);
    }
  });

  queue.queue(body("draft"));
  await queue.flush(body("final"));

  assert.deepEqual(savedBodies, ["final"]);
});

test("flush without editor changes is a no-op", async () => {
  let saveCount = 0;
  const queue = createItemBodyPersistenceQueue({
    persist: async () => {
      saveCount += 1;
    }
  });

  await queue.flush();

  assert.equal(saveCount, 0);
});

test("persistence queue reports state transitions around a save", async () => {
  const states: string[] = [];
  const queue = createItemBodyPersistenceQueue({
    debounceMs: 60_000,
    persist: async () => undefined,
    onStateChange: (state) => states.push(state)
  });

  queue.queue(body("text"));
  await queue.flush();

  assert.deepEqual(states, ["unsaved", "saving", "saved"]);
});

test("persistence queue can save a newer snapshot after an error", async () => {
  let attempts = 0;
  const savedBodies: string[] = [];
  const queue = createItemBodyPersistenceQueue({
    debounceMs: 60_000,
    persist: async (snapshot) => {
      attempts += 1;
      if (attempts === 1) throw new Error("disk unavailable");
      savedBodies.push(snapshot.text);
    }
  });

  queue.queue(body("failed"));
  await assert.rejects(() => queue.flush(), /disk unavailable/);
  queue.queue(body("recovered"));
  await queue.flush();

  assert.deepEqual(savedBodies, ["recovered"]);
});

function body(text: string): ItemBody {
  return { text, inlineMarks: [], lineBlocks: [], blockEntities: [] };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: () => resolvePromise?.() };
}
