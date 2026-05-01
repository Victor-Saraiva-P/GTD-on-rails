const defaultApiBaseUrl = "http://127.0.0.1:8080";

function normalizeApiBaseUrl(rawValue: string): string {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    throw new Error(`VITE_API_BASE_URL value '${rawValue}' is invalid; expected a non-empty absolute URL.`);
  }

  const normalizedUrl = new URL(trimmedValue);

  return normalizedUrl.toString().replace(/\/$/, "");
}

export const apiBaseUrl = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl
);

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

export function buildApiUrlWithVersion(pathname: string, version?: number): string {
  const url = new URL(buildApiUrl(pathname));

  if (version !== undefined) {
    url.searchParams.set("v", String(version));
  }

  return url.toString();
}
