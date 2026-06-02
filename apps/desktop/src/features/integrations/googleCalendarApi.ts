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

export async function fetchGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  return await apiJson<GoogleCalendarStatus>("/integrations/google-calendar/status");
}

export async function saveGoogleCredentials(clientId: string, clientSecret: string): Promise<void> {
  await apiFetch("/integrations/google-calendar/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret })
  });
}

export async function getAuthUrl(): Promise<{ url: string }> {
  return await apiJson<{ url: string }>("/integrations/google-calendar/auth-url", {
    method: "POST"
  });
}
