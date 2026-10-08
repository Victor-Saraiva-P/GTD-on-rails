import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContextItem } from "../contexts/types";
import { fetchAvailabilityEnvironmentSignals } from "./native";
import { resolveAutomaticContexts } from "./resolveAutomaticContexts";
import {
  AVAILABILITY_AUTOMATION_SETTINGS_CHANGED,
  loadAvailabilityAutomationSettings
} from "./storage";
import { EMPTY_AVAILABILITY_AUTOMATION_SETTINGS } from "./types";
import { useAvailabilityEnvironment } from "./useAvailabilityEnvironment";

const REFRESH_INTERVAL_MS = 15_000;

type AutomaticAvailabilityTarget = {
  applyAutomaticContexts: (contexts: ContextItem[]) => void;
};

/** Keeps the active automatic context candidate set synchronized with device and NetworkManager signals.
 *
 * @example useAvailabilityAutomation(contexts, nextActionsController)
 */
export function useAvailabilityAutomation(contexts: ContextItem[], target: AutomaticAvailabilityTarget) {
  const [settings, setSettings] = useState(() => currentSettings());
  const environment = useAvailabilityEnvironment(fetchAvailabilityEnvironmentSignals);
  const automaticContexts = useMemo(
    () => environment.signals ? resolveAutomaticContexts(contexts, environment.signals, settings) : [],
    [contexts, environment.signals, settings]
  );
  const detectCurrentContexts = useCallback(async () => {
    const signals = await environment.refresh();
    return signals ? resolveAutomaticContexts(contexts, signals, settings) : null;
  }, [contexts, environment.refresh, settings]);
  useEnvironmentRefresh(environment.refresh);
  useSettingsRefresh(setSettings);
  useResolvedContextSync(automaticContexts, target.applyAutomaticContexts);
  return { automaticContexts, detectCurrentContexts, settings, ...environment };
}

function useResolvedContextSync(contexts: ContextItem[], applyAutomaticContexts: (contexts: ContextItem[]) => void) {
  const applyRef = useRef(applyAutomaticContexts);
  applyRef.current = applyAutomaticContexts;
  const contextKey = contexts.map((context) => `${context.id}:${context.name}:${context.iconRevision ?? 0}`).join("|");
  useEffect(() => {
    applyRef.current(contexts);
  }, [contextKey]);
}

function useEnvironmentRefresh(refresh: () => Promise<unknown>) {
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
}

function useSettingsRefresh(setSettings: (settings: ReturnType<typeof currentSettings>) => void) {
  useEffect(() => {
    const reload = () => setSettings(currentSettings());
    window.addEventListener(AVAILABILITY_AUTOMATION_SETTINGS_CHANGED, reload);
    return () => window.removeEventListener(AVAILABILITY_AUTOMATION_SETTINGS_CHANGED, reload);
  }, [setSettings]);
}

function currentSettings() {
  if (typeof window === "undefined") return structuredClone(EMPTY_AVAILABILITY_AUTOMATION_SETTINGS);
  return loadAvailabilityAutomationSettings(window.localStorage);
}
