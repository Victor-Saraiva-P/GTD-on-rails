import assert from "node:assert/strict";
import test from "node:test";

import { buildApiUrl } from "../src/config/env.ts";
import { clearAssetObjectUrlCache, getCachedAssetObjectUrl, getCachedPdfFirstPagePreviewUrl, preloadAssetObjectUrl } from "../src/features/inbox/assetFiles.ts";

test("getCachedAssetObjectUrl reuses the same in-flight asset URL", async () => {
  clearAssetObjectUrlCache();

  const firstPromise = getCachedAssetObjectUrl("items/id/file.pdf", "application/pdf", "/assets/items/id/file.pdf");
  const secondPromise = getCachedAssetObjectUrl("items/id/file.pdf", "application/pdf", "/assets/items/id/file.pdf");

  assert.equal(firstPromise, secondPromise);
  assert.equal((await firstPromise).url, buildApiUrl("/assets/items/id/file.pdf"));
});

test("preloadAssetObjectUrl warms the preview cache", async () => {
  clearAssetObjectUrlCache();

  const preloadPromise = preloadAssetObjectUrl("items/id/image.png", "image/png", "/assets/items/id/image.png");
  const previewPromise = getCachedAssetObjectUrl("items/id/image.png", "image/png", "/assets/items/id/image.png");

  assert.equal(preloadPromise, previewPromise);
  assert.equal((await previewPromise).url, buildApiUrl("/assets/items/id/image.png"));
});

test("getCachedAssetObjectUrl falls back to public asset path", async () => {
  clearAssetObjectUrlCache();

  const assetUrl = await getCachedAssetObjectUrl("items/id/file.pdf", "application/pdf");

  assert.equal(assetUrl.url, buildApiUrl("/assets/items/id/file.pdf"));
});

test("clearAssetObjectUrlCache drops cached preview promises", () => {
  clearAssetObjectUrlCache();

  const cachedPromise = getCachedAssetObjectUrl("items/id/file.pdf", "application/pdf", "/assets/items/id/file.pdf");
  clearAssetObjectUrlCache();

  const freshPromise = getCachedAssetObjectUrl("items/id/file.pdf", "application/pdf", "/assets/items/id/file.pdf");
  assert.notEqual(cachedPromise, freshPromise);
});

test("getCachedPdfFirstPagePreviewUrl skips native rendering outside Tauri", async () => {
  clearAssetObjectUrlCache();

  const previewUrl = await getCachedPdfFirstPagePreviewUrl("items/id/file.pdf");

  assert.equal(previewUrl, null);
});
