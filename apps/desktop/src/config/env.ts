const defaultApiBaseUrl = "http://127.0.0.1:8080";
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
  if (!pathname) {
    return apiBaseUrl;
  }

  if (/^https?:\/\//.test(pathname)) {
    return pathname;
  }

  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return `${apiBaseUrl}${normalizedPathname}`;
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
