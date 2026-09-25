import { buildApiUrl } from "../../config/env.ts";
import { isTauriRuntime } from "../tauriRuntime.ts";

type ApiFetchTransport = (input: string, init?: RequestInit) => Promise<Response>;

export const DATABASE_UNAVAILABLE_EVENT = "gtd-database-unavailable";

const inFlightJsonGets = new Map<string, Promise<unknown>>();

/**
 * Extracts a human-readable error description from an API response body.
 *
 * @example extractApiErrorMessage('{"detail":"Invalid URL"}', 400)
 */
export function extractApiErrorMessage(responseBody: string, status: number): string {
  const fallback = `API request failed with status ${status}`;
  if (!responseBody || responseBody.trim().length === 0) return fallback;
  try {
    const parsed: unknown = JSON.parse(responseBody);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (typeof record.detail === "string" && record.detail.trim().length > 0) {
        return record.detail.trim();
      }
      if (typeof record.message === "string" && record.message.trim().length > 0) {
        return record.message.trim();
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, responseBody: string, message?: string) {
    super(message ?? extractApiErrorMessage(responseBody, status));
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
  let response: Response;
  try {
    response = await transport(buildApiUrl(pathname), {
      ...init,
      headers: { Accept: "application/json", ...init.headers }
    });
  } catch (error) {
    throw error;
  }

  if (!response.ok) {
    const responseBody = await response.text();
    if (isDatabaseUnavailableResponse(pathname, response.status, responseBody)) {
      notifyDatabaseUnavailable();
    }
    throw new ApiRequestError(response.status, responseBody);
  }

  return response;
}

function isDatabaseUnavailableResponse(
  pathname: string,
  status: number,
  responseBody: string
): boolean {
  if (status !== 503) return false;
  if (pathname === "/readiness") return true;

  try {
    const parsed: unknown = JSON.parse(responseBody);
    if (!parsed || typeof parsed !== "object") return false;
    const type = (parsed as Record<string, unknown>).type;
    return typeof type === "string" && type.endsWith("/database-unavailable");
  } catch {
    return false;
  }
}

function notifyDatabaseUnavailable(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DATABASE_UNAVAILABLE_EVENT));
}

async function tauriHttpFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!isTauriRuntime()) {
    return fetch(input, init);
  }

  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");

  return tauriFetch(input, init);
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
  if (transport !== undefined || init !== undefined) {
    const response = await apiFetch(pathname, init, transport);
    return response.json() as Promise<T>;
  }

  const existing = inFlightJsonGets.get(pathname);
  if (existing) return existing as Promise<T>;

  const request = apiFetch(pathname)
    .then((response) => response.json() as Promise<T>)
    .finally(() => {
      if (inFlightJsonGets.get(pathname) === request) inFlightJsonGets.delete(pathname);
    });
  inFlightJsonGets.set(pathname, request);
  return request;
}
