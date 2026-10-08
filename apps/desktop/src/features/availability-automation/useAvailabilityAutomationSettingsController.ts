import { useEffect, useState } from "react";
import { useContextsQuery } from "../contexts/useContextsQuery";
import { fetchAvailabilityEnvironmentSignals } from "./native";
import { loadAvailabilityAutomationSettings, saveAvailabilityAutomationSettings } from "./storage";
import type { AvailabilityAutomationSettings } from "./types";
import { useAvailabilityEnvironment } from "./useAvailabilityEnvironment";

/** Edits machine-local mappings from environment signals to existing GTD contexts.
 *
 * @example const controller = useAvailabilityAutomationSettingsController()
 */
export function useAvailabilityAutomationSettingsController() {
  const contextsQuery = useContextsQuery();
  const environment = useAvailabilityEnvironment(fetchAvailabilityEnvironmentSignals);
  const settingsState = useAvailabilitySettingsState();
  useEffect(() => { void environment.refresh(); }, [environment.refresh]);
  return {
    contexts: contextsQuery.contexts,
    contextsLoading: contextsQuery.isLoading,
    ...environment,
    ...settingsState,
    error: environment.error ?? environment.signals?.locationError ?? contextsQuery.errorMessage
  };
}

function useAvailabilitySettingsState() {
  const [settings, setSettings] = useState<AvailabilityAutomationSettings>(() => loadAvailabilityAutomationSettings(window.localStorage));
  const [saved, setSaved] = useState(false);
  const save = () => {
    saveAvailabilityAutomationSettings(window.localStorage, settings);
    setSaved(true);
  };
  const setDeviceContextId = (contextId: string | null) => {
    setSaved(false);
    setSettings((current) => ({ ...current, deviceContextId: contextId }));
  };
  const setLocationContextId = (locationId: string, contextId: string | null) => {
    setSaved(false);
    setSettings((current) => ({ ...current, locationContextIds: updateLocationMapping(current.locationContextIds, locationId, contextId) }));
  };
  return { save, saved, settings, setDeviceContextId, setLocationContextId };
}

function updateLocationMapping(current: Record<string, string>, locationId: string, contextId: string | null): Record<string, string> {
  if (contextId) return { ...current, [locationId]: contextId };
  const next = { ...current };
  delete next[locationId];
  return next;
}

export type AvailabilityAutomationSettingsController = ReturnType<typeof useAvailabilityAutomationSettingsController>;
