type BrowserWindow = Window & typeof globalThis & {
  __TAURI_INTERNALS__?: unknown;
};

/**
 * Detects whether the frontend is running inside the Tauri WebView.
 *
 * @example if (isTauriRuntime()) await invoke("native_command")
 */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as BrowserWindow).__TAURI_INTERNALS__ !== undefined
  );
}
