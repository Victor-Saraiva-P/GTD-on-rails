import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import { buildApiUrl, buildDocumentAssetPath } from "../../config/env";

export type AssetObjectUrl = {
  revoke: boolean;
  url: string;
};

type BrowserWindow = Window & typeof globalThis & {
  __TAURI_INTERNALS__?: unknown;
};

/**
 * Reads an asset from the Documents-scoped Tauri fs plugin.
 *
 * @example await readDocumentAssetBytes("items/id/file.pdf")
 */
export function readDocumentAssetBytes(relativePath: string): Promise<Uint8Array> {
  return readFile(buildDocumentAssetPath(relativePath), { baseDir: BaseDirectory.Document });
}

/**
 * Creates an object URL for an asset, falling back to HTTP in web-only tests.
 *
 * @example await createAssetObjectUrl("items/id/image.png", "image/png", "/assets/items/id/image.png")
 */
export async function createAssetObjectUrl(relativePath: string | undefined, contentType: string | undefined, fallbackUrl?: string): Promise<AssetObjectUrl> {
  if (!relativePath || !isTauriRuntime()) return fallbackAssetObjectUrl(fallbackUrl);
  const bytes = await readDocumentAssetBytes(relativePath);
  return { url: URL.createObjectURL(new Blob([bytesArrayBuffer(bytes)], { type: contentType })), revoke: true };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fallbackAssetObjectUrl(fallbackUrl?: string): AssetObjectUrl {
  return { url: buildApiUrl(fallbackUrl || ""), revoke: false };
}

function bytesArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isTauriRuntime(): boolean {
  return (window as BrowserWindow).__TAURI_INTERNALS__ !== undefined;
}
