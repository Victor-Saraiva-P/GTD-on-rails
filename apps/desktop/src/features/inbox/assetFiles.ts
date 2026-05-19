import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { buildApiUrl, buildDocumentAssetPath } from "../../config/env.ts";

export type AssetObjectUrl = {
  revoke: boolean;
  url: string;
};

type AssetObjectUrlCacheEntry = {
  promise: Promise<AssetObjectUrl>;
  revoke: boolean;
  url: string | null;
};

type PdfFirstPagePreviewResponse = {
  bytesBase64: string;
  mimeType: string;
};

type BrowserWindow = Window & typeof globalThis & {
  __TAURI_INTERNALS__?: unknown;
};

const assetObjectUrlCache = new Map<string, AssetObjectUrlCacheEntry>();
const pdfFirstPagePreviewCache = new Map<string, AssetObjectUrlCacheEntry>();

/**
 * Reads an asset from the Documents-scoped Tauri fs plugin.
 *
 * @example await readDocumentAssetBytes("items/id/file.pdf")
 */
export function readDocumentAssetBytes(relativePath: string): Promise<Uint8Array> {
  return readFile(buildDocumentAssetPath(relativePath), { baseDir: BaseDirectory.Document });
}

/**
 * Returns one stable object URL per asset until the preview cache is cleared.
 *
 * @example await getCachedAssetObjectUrl("items/id/image.png", "image/png", "/assets/items/id/image.png")
 */
export function getCachedAssetObjectUrl(relativePath: string | undefined, contentType: string | undefined, fallbackUrl?: string): Promise<AssetObjectUrl> {
  const key = assetObjectUrlCacheKey(relativePath, contentType, fallbackUrl);
  const cachedEntry = assetObjectUrlCache.get(key);
  if (cachedEntry) return cachedEntry.promise;

  const entry = createAssetObjectUrlCacheEntry(key, relativePath, contentType, fallbackUrl);
  assetObjectUrlCache.set(key, entry);
  return entry.promise;
}

/**
 * Warms the stable preview URL cache without rendering a visible loader.
 *
 * @example void preloadAssetObjectUrl("items/id/image.png", "image/png", "/assets/items/id/image.png")
 */
export function preloadAssetObjectUrl(relativePath: string | undefined, contentType: string | undefined, fallbackUrl?: string): Promise<AssetObjectUrl> {
  return getCachedAssetObjectUrl(relativePath, contentType, fallbackUrl);
}

/**
 * Returns a stable PNG thumbnail URL for the first PDF page in Tauri.
 *
 * @example await getCachedPdfFirstPagePreviewUrl("items/id/file.pdf")
 */
export function getCachedPdfFirstPagePreviewUrl(relativePath: string | undefined): Promise<AssetObjectUrl | null> {
  if (!relativePath || !isTauriRuntime()) return Promise.resolve(null);
  const key = assetObjectUrlCacheKey(relativePath, "image/png", "pdf-first-page");
  const cachedEntry = pdfFirstPagePreviewCache.get(key);
  if (cachedEntry) return cachedEntry.promise;

  const entry = createPdfFirstPagePreviewCacheEntry(key, relativePath);
  pdfFirstPagePreviewCache.set(key, entry);
  return entry.promise;
}

/**
 * Revokes all cached object URLs when leaving the inbox/detail asset workflow.
 *
 * @example clearAssetObjectUrlCache()
 */
export function clearAssetObjectUrlCache(): void {
  revokeAssetObjectUrlCache(assetObjectUrlCache);
  revokeAssetObjectUrlCache(pdfFirstPagePreviewCache);
  assetObjectUrlCache.clear();
  pdfFirstPagePreviewCache.clear();
}

async function createAssetObjectUrl(relativePath: string | undefined, contentType: string | undefined, fallbackUrl?: string): Promise<AssetObjectUrl> {
  if (!relativePath || !isTauriRuntime()) return fallbackAssetObjectUrl(relativePath, fallbackUrl);
  const bytes = await readDocumentAssetBytes(relativePath).catch((error: unknown) => {
    if (fallbackUrl || relativePath) return null;
    throw error;
  });
  if (!bytes) return fallbackAssetObjectUrl(relativePath, fallbackUrl);
  return { url: URL.createObjectURL(new Blob([bytesArrayBuffer(bytes)], { type: contentType })), revoke: true };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fallbackAssetObjectUrl(relativePath: string | undefined, fallbackUrl?: string): AssetObjectUrl {
  return { url: buildApiUrl(fallbackUrl || assetPublicPath(relativePath)), revoke: false };
}

function assetPublicPath(relativePath: string | undefined): string {
  return relativePath ? `/assets/${relativePath.replace(/^\/+/, "")}` : "";
}

function assetObjectUrlCacheKey(relativePath: string | undefined, contentType: string | undefined, fallbackUrl?: string): string {
  return JSON.stringify([relativePath ?? "", contentType ?? "", fallbackUrl ?? ""]);
}

function createAssetObjectUrlCacheEntry(key: string, relativePath: string | undefined, contentType: string | undefined, fallbackUrl?: string): AssetObjectUrlCacheEntry {
  const entry: AssetObjectUrlCacheEntry = { promise: Promise.resolve({ url: "", revoke: false }), revoke: false, url: null };
  entry.promise = createAssetObjectUrl(relativePath, contentType, fallbackUrl)
    .then((assetUrl) => cacheLoadedAssetObjectUrl(assetObjectUrlCache, key, entry, assetUrl))
    .catch((error: unknown) => { assetObjectUrlCache.delete(key); throw error; });
  return entry;
}

function createPdfFirstPagePreviewCacheEntry(key: string, relativePath: string): AssetObjectUrlCacheEntry {
  const entry: AssetObjectUrlCacheEntry = { promise: Promise.resolve({ url: "", revoke: false }), revoke: false, url: null };
  entry.promise = createPdfFirstPagePreviewUrl(relativePath)
    .then((assetUrl) => cacheLoadedAssetObjectUrl(pdfFirstPagePreviewCache, key, entry, assetUrl))
    .catch((error: unknown) => { pdfFirstPagePreviewCache.delete(key); throw error; });
  return entry;
}

async function createPdfFirstPagePreviewUrl(relativePath: string): Promise<AssetObjectUrl> {
  const bytes = await readDocumentAssetBytes(relativePath);
  const preview = await invoke<PdfFirstPagePreviewResponse>("render_pdf_first_page_preview", { bytesBase64: bytesToBase64(bytes) });
  const bytesBuffer = base64ToBytes(preview.bytesBase64);
  return { url: URL.createObjectURL(new Blob([bytesArrayBuffer(bytesBuffer)], { type: preview.mimeType })), revoke: true };
}

function cacheLoadedAssetObjectUrl(cache: Map<string, AssetObjectUrlCacheEntry>, key: string, entry: AssetObjectUrlCacheEntry, assetUrl: AssetObjectUrl): AssetObjectUrl {
  if (cache.get(key) !== entry) {
    if (assetUrl.revoke) URL.revokeObjectURL(assetUrl.url);
    return assetUrl;
  }
  entry.url = assetUrl.url;
  entry.revoke = assetUrl.revoke;
  return assetUrl;
}

function revokeAssetObjectUrlCache(cache: Map<string, AssetObjectUrlCacheEntry>): void {
  for (const entry of cache.values()) {
    if (entry.url && entry.revoke) URL.revokeObjectURL(entry.url);
  }
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function bytesArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && (window as BrowserWindow).__TAURI_INTERNALS__ !== undefined;
}
