import { invoke } from "@tauri-apps/api/core";

/**
 * Reads text from the native clipboard, falling back to browser clipboard APIs.
 *
 * @example const link = await readMarkdownLinkClipboardText()
 */
export async function readMarkdownLinkClipboardText(): Promise<string> {
  return (await readTauriClipboardText()) || (await readBrowserClipboardText());
}

async function readTauriClipboardText(): Promise<string> {
  try {
    return (await invoke<string | null>("read_clipboard_text")) ?? "";
  } catch {
    return "";
  }
}

async function readBrowserClipboardText(): Promise<string> {
  if (!canReadBrowserClipboardText()) {
    return "";
  }

  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

function canReadBrowserClipboardText(): boolean {
  return "clipboard" in navigator && typeof navigator.clipboard.readText === "function";
}
