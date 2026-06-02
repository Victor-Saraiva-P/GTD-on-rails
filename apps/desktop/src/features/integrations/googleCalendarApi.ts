import { apiJson, apiFetch } from "../../lib/api/apiClient.ts";

export type GoogleCalendarInfo = {
  name: string;
  colorHex: string;
  googleCalendarId: string;
};

export type GoogleCalendarStatus = {
  credentialsConfigured: boolean;
  configurationStatus: "MISSING" | "READY" | "REPAIR_FAILED" | "INVALID";
  configurationMessage: string;
  connected: boolean;
  calendars: GoogleCalendarInfo[];
};

/**
 * Fetches the current Google Calendar integration status.
 *
 * @returns The configured credentials, connection, and GTD calendar mirror status.
 * @example const status = await fetchGoogleCalendarStatus();
 */
export async function fetchGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  return await apiJson<GoogleCalendarStatus>("/integrations/google-calendar/status");
}

/**
 * Saves Google OAuth client credentials for the integration.
 *
 * @param clientId The Google OAuth client id.
 * @param clientSecret The Google OAuth client secret.
 * @returns A promise that resolves after the credentials are persisted.
 * @example await saveGoogleCredentials(clientId, clientSecret);
 */
export async function saveGoogleCredentials(clientId: string, clientSecret: string): Promise<void> {
  await apiFetch("/integrations/google-calendar/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret })
  });
}

/**
 * Obtains the Google OAuth authorization URL.
 *
 * @returns The URL that starts the Google Calendar authorization flow.
 * @example const { url } = await getAuthUrl();
 */
export async function getAuthUrl(): Promise<{ url: string }> {
  return await apiJson<{ url: string }>("/integrations/google-calendar/auth-url", {
    method: "POST"
  });
}
