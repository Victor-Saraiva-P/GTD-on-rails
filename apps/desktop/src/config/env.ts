const defaultApiBaseUrl = "http://127.0.0.1:8080";
const defaultDataRootDirectoryName = "dev-gtd-on-rails";
const defaultUndoRedoMaxStackSize = 50;

function normalizeApiBaseUrl(rawValue: string): string {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    throw new Error(`VITE_API_BASE_URL value '${rawValue}' is invalid; expected a non-empty absolute URL.`);
  }

  const normalizedUrl = new URL(trimmedValue);

  return normalizedUrl.toString().replace(/\/$/, "");
}

function normalizeNumber(rawValue: string | undefined, defaultValue: number): number {
  if (rawValue === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(rawValue, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const viteEnv = (import.meta as any).env || {};
export const apiBaseUrl = normalizeApiBaseUrl(
  viteEnv.VITE_API_BASE_URL ?? defaultApiBaseUrl
);
let runtimeApiBaseUrl: string | null = null;

export const dataRootDirectoryName = normalizeDataRootDirectoryName(
  viteEnv.VITE_DATA_ROOT_DIRECTORY_NAME ?? defaultDataRootDirectoryName
);

export const undoRedoMaxStackSize = normalizeNumber(
  viteEnv.VITE_UNDO_REDO_MAX_STACK_SIZE,
  defaultUndoRedoMaxStackSize
);

/**
 * Builds an API URL from either an absolute URL or an API-relative pathname.
 *
 * @example buildApiUrl("/inbox")
 */
export function buildApiUrl(pathname: string): string {
  const currentApiBaseUrl = runtimeApiBaseUrl ?? apiBaseUrl;

  if (!pathname) {
    return currentApiBaseUrl;
  }

  if (/^https?:\/\//.test(pathname)) {
    return pathname;
  }

  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return `${currentApiBaseUrl}${normalizedPathname}`;
}

/**
 * Overrides the API base URL after Tauri discovers the sidecar port.
 *
 * @example setRuntimeApiBaseUrl("http://127.0.0.1:43127")
 */
export function setRuntimeApiBaseUrl(baseUrl: string | null): void {
  runtimeApiBaseUrl = baseUrl ? normalizeApiBaseUrl(baseUrl) : null;
}

/**
 * Builds a Documents-relative asset path for the Tauri fs plugin.
 *
 * @example buildDocumentAssetPath("items/id/file.pdf")
 */
export function buildDocumentAssetPath(relativePath: string): string {
  const normalizedPath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${dataRootDirectoryName}/assets/${normalizedPath}`;
}

function normalizeDataRootDirectoryName(rawValue: string): string {
  const trimmedValue = rawValue.trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmedValue)) {
    throw new Error(`VITE_DATA_ROOT_DIRECTORY_NAME value '${rawValue}' is invalid; expected a safe directory name.`);
  }
  return trimmedValue;
}

/**
 * Builds an API URL with a cache-busting version query parameter when one exists.
 *
 * @example buildApiUrlWithVersion("/assets/context.png", 3)
 */
export function buildApiUrlWithVersion(pathname: string, version?: number): string {
  const url = new URL(buildApiUrl(pathname));

  if (version !== undefined) {
    url.searchParams.set("v", String(version));
  }

  return url.toString();
}
