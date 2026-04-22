const defaultApiBaseUrl = "http://127.0.0.1:8080";

function normalizeApiBaseUrl(rawValue: string): string {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    throw new Error("VITE_API_BASE_URL cannot be empty");
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
