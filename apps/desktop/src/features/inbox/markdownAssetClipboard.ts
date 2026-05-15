import { invoke } from "@tauri-apps/api/core";

const ACCEPTED_ASSET_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml"
]);

type ClipboardImagePayload = {
  bytesBase64: string;
  mimeType: string;
  fileName: string;
};

export type LocalAssetPayload = {
  sourcePath: string;
  mimeType: string;
  fileName: string;
};

export type MarkdownAssetClipboardSource =
  | { type: "file"; file: File }
  | { type: "localFile"; sourcePath: string; fileName: string; mimeType: string };

/**
 * Reads an uploadable asset from clipboard APIs.
 *
 * @example await readMarkdownAssetClipboardFile()
 */
export async function readMarkdownAssetClipboardFile(): Promise<MarkdownAssetClipboardSource | null> {
  return (
    (await readTauriClipboardLocalFileAsset()) ??
    (await readTauriClipboardFileAsset()) ??
    (await readBrowserClipboardAsset()) ??
    (await readTauriClipboardImageAsset())
  );
}

function assetExtension(mimeType: string): string {
  const extension = mimeTypeToExtension(mimeType);
  return extension || mimeType.split("/")[1] || "bin";
}

function mimeTypeToExtension(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf": return "pdf";
    case "application/msword": return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return "docx";
    case "application/vnd.ms-excel": return "xls";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": return "xlsx";
    case "image/svg+xml": return "svg";
    case "image/jpeg": return "jpg";
    default: return "";
  }
}

function fileFromClipboardPayload(payload: ClipboardImagePayload): File {
  const bytes = Uint8Array.from(atob(payload.bytesBase64), (char) => char.charCodeAt(0));
  const fileName = payload.fileName || `clipboard-asset.${assetExtension(payload.mimeType)}`;

  return new File([bytes], fileName, { type: payload.mimeType });
}

async function readTauriClipboardImageAsset(): Promise<MarkdownAssetClipboardSource | null> {
  try {
    const clipboardImage = await invoke<ClipboardImagePayload | null>("read_clipboard_image");
    return clipboardImage ? { type: "file", file: fileFromClipboardPayload(clipboardImage) } : null;
  } catch {
    return null;
  }
}

async function readTauriClipboardLocalFileAsset(): Promise<MarkdownAssetClipboardSource | null> {
  try {
    const clipboardFile = await invoke<LocalAssetPayload | null>("read_clipboard_local_file_asset");
    return clipboardFile ? { type: "localFile", ...clipboardFile } : null;
  } catch {
    return null;
  }
}

async function readTauriClipboardFileAsset(): Promise<MarkdownAssetClipboardSource | null> {
  try {
    const clipboardFile = await invoke<ClipboardImagePayload | null>("read_clipboard_file_asset");
    return clipboardFile ? { type: "file", file: fileFromClipboardPayload(clipboardFile) } : null;
  } catch {
    return null;
  }
}

function canReadBrowserClipboard(): boolean {
  return "clipboard" in navigator && typeof navigator.clipboard.read === "function";
}

async function fileFromClipboardItem(clipboardItem: ClipboardItem): Promise<File | null> {
  const assetType = clipboardItem.types.find((type) => ACCEPTED_ASSET_TYPES.has(type));
  if (!assetType) {
    return null;
  }

  const blob = await clipboardItem.getType(assetType);
  return new File([blob], `clipboard-asset.${assetExtension(assetType)}`, { type: assetType });
}

async function readBrowserClipboardAsset(): Promise<MarkdownAssetClipboardSource | null> {
  if (!canReadBrowserClipboard()) {
    return null;
  }

  try {
    const file = await findBrowserClipboardAsset(await navigator.clipboard.read());
    return file ? { type: "file", file } : null;
  } catch {
    return null;
  }
}

async function findBrowserClipboardAsset(clipboardItems: ClipboardItem[]): Promise<File | null> {
  for (const clipboardItem of clipboardItems) {
    const file = await fileFromClipboardItem(clipboardItem);
    if (file) {
      return file;
    }
  }

  return null;
}
