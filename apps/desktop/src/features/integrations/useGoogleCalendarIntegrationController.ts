import { useEffect, useState } from "react";
import { fetchGoogleCalendarStatus, getAuthUrl, reconcileGoogleCalendars, type GoogleCalendarStatus } from "./googleCalendarApi";
import { openExternalUrl } from "../inbox/openExternalResource";

export type GoogleCalendarIntegrationController = ReturnType<typeof useGoogleCalendarIntegrationController>;

/**
 * Coordinates Google Calendar integration status loading and connect actions for integration screens.
 *
 * @returns Status, error, reload, connect, and setError actions; accepts no parameters.
 * @example const { status, connect, reload } = useGoogleCalendarIntegrationController();
 */
export function useGoogleCalendarIntegrationController() {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const s = await fetchGoogleCalendarStatus();
      setStatus(s);
      setError(null);
    } catch (e: unknown) {
      setError(errorMessageFrom(e));
    }
  };

  const connect = async () => {
    try {
      const { url } = await getAuthUrl();
      await openExternalUrl(url);
    } catch (e: unknown) {
      setError(errorMessageFrom(e));
    }
  };

  const reconcile = async () => {
    try {
      await reconcileGoogleCalendars();
      await reload();
    } catch (e: unknown) {
      setError(errorMessageFrom(e));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return { status, error, reload, connect, reconcile, setError };
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
