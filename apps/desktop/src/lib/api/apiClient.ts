import { buildApiUrl } from "../../config/env.ts";

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
export async function apiFetch(pathname: string, init: RequestInit = {}) {
  const response = await fetch(buildApiUrl(pathname), {
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

/**
 * Executes an API request and decodes the JSON response into the expected shape.
 *
 * @example await apiJson<Stuff[]>("/inbox")
 */
export async function apiJson<T>(pathname: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(pathname, init);

  return response.json() as Promise<T>;
}
