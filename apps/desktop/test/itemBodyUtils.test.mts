import assert from "node:assert/strict";
import test from "node:test";

import { reconcileBlockEntityTokenRanges } from "../src/features/inbox/itemBodyUtils.ts";
import type { ItemBody } from "../src/features/inbox/types.ts";

test("reconcileBlockEntityTokenRanges restores asset ranges from visible tokens", () => {
  const assetId = "3625c437-ee86-45de-8135-01f0b46fd3da";
  const token = `⟦asset:${assetId}⟧`;
  const body = staleAssetBody(`before ${token}`, assetId);

  const reconciled = reconcileBlockEntityTokenRanges(body);

  assert.equal(reconciled.blockEntities[0].from, 7);
  assert.equal(reconciled.blockEntities[0].to, 7 + token.length);
});

function staleAssetBody(text: string, assetId: string): ItemBody {
  return {
    text,
    inlineMarks: [],
    lineBlocks: [],
    blockEntities: [{ id: "entity-1", type: "image", from: 0, to: 0, assetId }]
  };
}
