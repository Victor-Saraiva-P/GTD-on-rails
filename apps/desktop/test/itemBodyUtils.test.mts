import assert from "node:assert/strict";
import test from "node:test";

import { bodyForPersistence, reconcileBlockEntityTokenRanges } from "../src/features/inbox/itemBodyUtils.ts";
import type { ItemBody } from "../src/features/inbox/types.ts";

test("reconcileBlockEntityTokenRanges restores asset ranges from visible tokens", () => {
  const assetId = "3625c437-ee86-45de-8135-01f0b46fd3da";
  const token = `⟦asset:${assetId}⟧`;
  const body = staleAssetBody(`before ${token}`, assetId);

  const reconciled = reconcileBlockEntityTokenRanges(body);

  assert.equal(reconciled.blockEntities[0].from, 7);
  assert.equal(reconciled.blockEntities[0].to, 7 + token.length);
});

test("reconcileBlockEntityTokenRanges preserves missing asset metadata for undo", () => {
  const assetId = "1295e283-5347-4244-a1ef-403e3919add4";
  const body = staleAssetBody("blabalbalba\n", assetId);

  const reconciled = reconcileBlockEntityTokenRanges(body);

  assert.deepEqual(reconciled.blockEntities, body.blockEntities);
});

test("bodyForPersistence removes asset entities without visible tokens", () => {
  const assetId = "1295e283-5347-4244-a1ef-403e3919add4";
  const body = staleAssetBody("blabalbalba\n", assetId);

  const reconciled = bodyForPersistence(body);

  assert.deepEqual(reconciled.blockEntities, []);
});

function staleAssetBody(text: string, assetId: string): ItemBody {
  return {
    text,
    inlineMarks: [],
    lineBlocks: [],
    blockEntities: [{ id: "entity-1", type: "image", from: 0, to: 0, assetId }]
  };
}
