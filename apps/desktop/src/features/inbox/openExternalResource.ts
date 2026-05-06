import { invoke } from "@tauri-apps/api/core";
import { buildApiUrl } from "../../config/env";
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
  const bytesBase64 = await assetBytesBase64(url);
  await invoke("open_temp_asset", {
    bytesBase64,
    fileName: entity.attrs?.displayName || entity.assetId
  });
}

async function assetBytesBase64(url: string): Promise<string> {
  const buffer = await (await fetch(url)).arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function isTauriRuntime(): boolean {
  return (window as BrowserWindow).__TAURI_INTERNALS__ !== undefined;
}

function openBrowserUrl(url: string): void {
  window.open(url, "_blank", "noreferrer");
}
