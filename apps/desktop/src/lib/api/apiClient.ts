import { buildApiUrl } from "../../config/env.ts";

type ApiFetchTransport = (input: string, init?: RequestInit) => Promise<Response>;
type BrowserWindow = Window & typeof globalThis & {
  __TAURI_INTERNALS__?: unknown;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, responseBody: string, message?: string) {
    super(message ?? `API request failed with status ${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

/**
 * Executes a fetch request against the configured API base URL.
 *
 * @example await apiFetch("/inbox")
 */
export async function apiFetch(
  pathname: string,
  init: RequestInit = {},
  transport: ApiFetchTransport = tauriHttpFetch
): Promise<Response> {
  const response = await transport(buildApiUrl(pathname), {
    ...init,
    headers: {
      Accept: "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new ApiRequestError(response.status, responseBody);
  }

  return response;
}

async function tauriHttpFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!isTauriRuntime()) {
    return fetch(input, init);
  }

  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");

  return tauriFetch(input, init);
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as BrowserWindow).__TAURI_INTERNALS__ !== undefined
  );
}

/**
 * Executes an API request and decodes the JSON response into the expected shape.
 *
 * @example await apiJson<Stuff[]>("/inbox")
 */
export async function apiJson<T>(
  pathname: string,
  init?: RequestInit,
  transport?: ApiFetchTransport
): Promise<T> {
  const response = await apiFetch(pathname, init, transport);

  return response.json() as Promise<T>;
}
