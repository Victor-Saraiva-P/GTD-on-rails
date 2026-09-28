import assert from "node:assert/strict";
import test from "node:test";

import { buildApiUrl } from "../src/config/env.ts";
import {
  clearAssetObjectUrlCache,
  getCachedAssetObjectUrl,
  getCachedPdfFirstPagePreviewUrl,
  preloadAssetObjectUrl,
  readManagedItemAssetWithLegacyFallback
} from "../src/features/inbox/assetFiles.ts";

class LegacyOnlyAssetReader {
  readonly requestedPaths: string[] = [];

  async read(relativePath: string): Promise<Uint8Array> {
    this.requestedPaths.push(relativePath);
    if (relativePath === "assets/items/b37517f1-e812-4ee7-9bf3-23a08aed7f8d/d9fa6d87-0831-4c66-92a2-a164b8e5d333/clipboard-icon.png") {
      return new Uint8Array([1, 2, 3]);
    }
    throw new Error(`asset path '${relativePath}' is missing; expected the managed or legacy item asset path`);
  }
}

test("reads a Markdown item asset from its legacy storage layout", async () => {
  const reader = new LegacyOnlyAssetReader();
  const bytes = await readManagedItemAssetWithLegacyFallback(
    "items/b37517f1-e812-4ee7-9bf3-23a08aed7f8d/assets/d9fa6d87-0831-4c66-92a2-a164b8e5d333/clipboard-icon.png",
    reader.read.bind(reader)
  );

  assert.deepEqual([...bytes], [1, 2, 3]);
  assert.deepEqual(reader.requestedPaths, [
    "items/b37517f1-e812-4ee7-9bf3-23a08aed7f8d/assets/d9fa6d87-0831-4c66-92a2-a164b8e5d333/clipboard-icon.png",
    "assets/items/b37517f1-e812-4ee7-9bf3-23a08aed7f8d/d9fa6d87-0831-4c66-92a2-a164b8e5d333/clipboard-icon.png"
  ]);
});

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
