import { invoke } from "@tauri-apps/api/core";
import { bytesToBase64, readDocumentAssetBytes } from "./assetFiles";
import { buildApiUrl } from "../../config/env";
import { apiFetch } from "../../lib/api/apiClient";
import type { BlockEntity } from "./types.ts";

type BrowserWindow = Window & typeof globalThis & {
  __TAURI_INTERNALS__?: unknown;
};

/**
 * Opens an external link with the operating system when Tauri is available.
 *
 * @example await openExternalUrl("https://example.com")
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) return openBrowserUrl(url);
  await invoke("open_external_url", { url }).catch(() => openBrowserUrl(url));
}

/**
 * Opens an asset with the operating system default app when Tauri is available.
 *
 * @example await openAssetWithDefaultApp(entity)
 */
export async function openAssetWithDefaultApp(entity: BlockEntity): Promise<void> {
  const url = buildApiUrl(entity.attrs?.url || "");
  if (!isTauriRuntime()) return openBrowserUrl(url);
  await openTauriAsset(entity, url).catch(() => openBrowserUrl(url));
}

async function openTauriAsset(entity: BlockEntity, url: string): Promise<void> {
  const bytesBase64 = await assetBytesBase64(entity, url);
  await invoke("open_temp_asset", {
    bytesBase64,
    fileName: entity.attrs?.displayName || entity.assetId
  });
}

async function assetBytesBase64(entity: BlockEntity, url: string): Promise<string> {
  const relativePath = entity.attrs?.relativePath ?? entity.attrs?.localPath;
  const bytes = relativePath ? await readDocumentAssetBytes(relativePath) : await fetchAssetBytes(url);
  return bytesToBase64(bytes);
}

async function fetchAssetBytes(url: string): Promise<Uint8Array> {
  return new Uint8Array(await (await apiFetch(url)).arrayBuffer());
}

function isTauriRuntime(): boolean {
  return (window as BrowserWindow).__TAURI_INTERNALS__ !== undefined;
}

function openBrowserUrl(url: string): void {
  window.open(url, "_blank", "noreferrer");
}
