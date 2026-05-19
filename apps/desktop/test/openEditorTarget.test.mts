import assert from "node:assert/strict";
import test from "node:test";

import { findOpenableEditorTarget } from "../src/features/inbox/openEditorTarget.ts";
import type { ItemBody } from "../src/features/inbox/types.ts";

test("findOpenableEditorTarget returns link under cursor", () => {
  const body = bodyWithLink("docs", "https://example.com");

  assert.deepEqual(findOpenableEditorTarget(body, 2), {
    type: "link",
    url: "https://example.com"
  });
});

test("findOpenableEditorTarget returns asset under cursor before link", () => {
  const body = bodyWithAssetAndLink("https://example.com");

  assert.equal(findOpenableEditorTarget(body, 2)?.type, "asset");
});

function bodyWithLink(text: string, href: string): ItemBody {
  return {
    text,
    inlineMarks: [{ id: "link-1", type: "link", from: 0, to: text.length, attrs: { href } }],
    lineBlocks: [],
    blockEntities: []
  };
}

function bodyWithAssetAndLink(href: string): ItemBody {
  return {
    ...bodyWithLink("asset", href),
    blockEntities: [{ id: "asset-1", type: "file", from: 0, to: 5, assetId: "asset-id" }]
  };
}
