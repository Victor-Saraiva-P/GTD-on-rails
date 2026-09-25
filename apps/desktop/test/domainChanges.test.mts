import assert from "node:assert/strict";
import test from "node:test";

import { createDomainRevalidationScheduler } from "../src/features/sync-status/domainChanges.ts";

test("domain revalidation scheduler coalesces rapid events", async () => {
  let reloads = 0;
  const scheduler = createDomainRevalidationScheduler(() => {
    reloads += 1;
  }, 5);

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();

  assert.equal(reloads, 0);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(reloads, 1);
});

test("domain revalidation scheduler cancels a pending reload", async () => {
  let reloads = 0;
  const scheduler = createDomainRevalidationScheduler(() => {
    reloads += 1;
  }, 5);

  scheduler.schedule();
  scheduler.cancel();

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(reloads, 0);
});
