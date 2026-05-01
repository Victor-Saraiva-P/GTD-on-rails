import { invoke } from "@tauri-apps/api/core";

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/svg+xml", "image/webp"]);

type ClipboardImagePayload = {
  bytesBase64: string;
  mimeType: string;
  fileName: string;
};

export function hasPotentialClipboardImage(source: DataTransfer | null): boolean {
  if (!source) {
    return false;
  }

  const types = Array.from(source.types ?? []);

  return types.includes("Files") || Array.from(source.items ?? []).some(isClipboardImageItem);
}

export async function readClipboardImage(): Promise<File | null> {
  return (await readTauriClipboardImage()) ?? (await readBrowserClipboardImage());
}

function isClipboardImageItem(item: DataTransferItem): boolean {
  return item.kind === "file" || ACCEPTED_IMAGE_TYPES.has(item.type);
}

function clipboardExtension(mimeType: string): string {
  return mimeType === "image/svg+xml" ? "svg" : mimeType.split("/")[1] ?? "png";
}

function fileFromClipboardPayload(payload: ClipboardImagePayload): File {
  const bytes = Uint8Array.from(atob(payload.bytesBase64), (char) => char.charCodeAt(0));
  const fileName = payload.fileName || `clipboard-icon.${clipboardExtension(payload.mimeType)}`;

  return new File([bytes], fileName, { type: payload.mimeType });
}

async function readTauriClipboardImage(): Promise<File | null> {
  try {
    const clipboardImage = await invoke<ClipboardImagePayload | null>("read_clipboard_image");

    return clipboardImage ? fileFromClipboardPayload(clipboardImage) : null;
  } catch {
    return null;
  }
}

function canReadBrowserClipboard(): boolean {
  return "clipboard" in navigator && typeof navigator.clipboard.read === "function";
}

async function fileFromClipboardItem(clipboardItem: ClipboardItem): Promise<File | null> {
  const imageType = clipboardItem.types.find((type) => ACCEPTED_IMAGE_TYPES.has(type));

  if (!imageType) {
    return null;
  }

  const blob = await clipboardItem.getType(imageType);

  return new File([blob], `clipboard-icon.${clipboardExtension(imageType)}`, { type: imageType });
}

async function readBrowserClipboardImage(): Promise<File | null> {
  if (!canReadBrowserClipboard()) {
    return null;
  }

  try {
    return findBrowserClipboardImage(await navigator.clipboard.read());
  } catch {
    return null;
  }
}

async function findBrowserClipboardImage(clipboardItems: ClipboardItem[]): Promise<File | null> {
  for (const clipboardItem of clipboardItems) {
    const file = await fileFromClipboardItem(clipboardItem);

    if (file) {
      return file;
    }
  }

  return null;
}
