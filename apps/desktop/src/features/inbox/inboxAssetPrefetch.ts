import type { BlockEntity, Stuff } from "./types";
import { preloadAssetObjectUrl } from "./assetFiles";

const ASSET_PREFETCH_RADIUS = 1;

function isPreviewableEntity(entity: BlockEntity): boolean {
  return (
    entity.type === "image" ||
    entity.type === "pdf" ||
    entity.attrs?.contentType?.startsWith("image/") === true ||
    entity.attrs?.contentType === "application/pdf"
  );
}

function prefetchBlockEntityAsset(entity: BlockEntity): void {
  if (!isPreviewableEntity(entity)) return;
  const relativePath = entity.attrs?.relativePath ?? entity.attrs?.localPath;
  void preloadAssetObjectUrl(relativePath, entity.attrs?.contentType, entity.attrs?.url).catch(() => undefined);
}

function prefetchStuffAssets(item: Stuff): void {
  item.body.blockEntities.forEach(prefetchBlockEntityAsset);
}

/**
 * Prefetches nearby inbox assets around a selection.
 *
 * @example prefetchNearbyInboxAssets(stuffs, selectedIndex)
 */
export function prefetchNearbyInboxAssets(stuffs: Stuff[], selectedIndex: number): void {
  const startIndex = Math.max(0, selectedIndex - ASSET_PREFETCH_RADIUS);
  const endIndex = Math.min(stuffs.length - 1, selectedIndex + ASSET_PREFETCH_RADIUS);
  for (let index = startIndex; index <= endIndex; index += 1) {
    prefetchStuffAssets(stuffs[index]);
  }
}
