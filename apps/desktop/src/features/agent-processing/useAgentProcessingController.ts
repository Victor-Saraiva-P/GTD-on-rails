import { useCallback, useEffect, useState } from "react";
import { loadAgentProcessingOptions, loadAgentProcessingSettings, saveAgentProcessingSettings } from "./native";
import type { AgentProcessingOptions, AgentProcessingSettings, AgentProviderSettings, ProcessingAgent } from "./types";

const emptySettings: AgentProcessingSettings = {
  processor: "antigravity",
  antigravity: { model: null, thinking: null },
  codex: { model: null, thinking: null }
};

const emptyOptions: AgentProcessingOptions = {
  antigravity: { available: false, models: [], thinking: [] },
  codex: { available: false, models: [], thinking: [] }
};

function messageFrom(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error) || "Agent processing settings failed.";
}

function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function useAgentProcessingState() {
  const [settings, setSettings] = useState<AgentProcessingSettings>(emptySettings);
  const [options, setOptions] = useState<AgentProcessingOptions>(emptyOptions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return { error, loading, options, refreshing, saved, saving, settings, setError, setLoading, setOptions, setRefreshing, setSaved, setSaving, setSettings };
}

function useReload(state: ReturnType<typeof useAgentProcessingState>) {
  return useCallback(async () => {
    state.setLoading(true);
    state.setError(null);
    state.setSaved(false);
    try {
      const [settings, options] = await Promise.all([loadAgentProcessingSettings(), loadAgentProcessingOptions()]);
      state.setSettings(settings);
      state.setOptions(options);
    } catch (failure) {
      state.setError(messageFrom(failure));
    } finally {
      state.setLoading(false);
    }
  }, []);
}

function useRefreshOptions(state: ReturnType<typeof useAgentProcessingState>) {
  return useCallback(async () => {
    state.setRefreshing(true);
    state.setError(null);
    try {
      state.setOptions(await loadAgentProcessingOptions(true));
    } catch (failure) {
      state.setError(messageFrom(failure));
    } finally {
      state.setRefreshing(false);
    }
  }, []);
}

function useSave(state: ReturnType<typeof useAgentProcessingState>) {
  return useCallback(async () => {
    state.setSaving(true);
    state.setError(null);
    try {
      await saveAgentProcessingSettings(state.settings);
      state.setSaved(true);
    } catch (failure) {
      state.setError(messageFrom(failure));
    } finally {
      state.setSaving(false);
    }
  }, [state.settings]);
}

function useUpdateProcessor(state: ReturnType<typeof useAgentProcessingState>) {
  return useCallback((processor: ProcessingAgent) => {
    state.setSaved(false);
    state.setSettings(current => ({ ...current, processor }));
  }, []);
}

function useUpdateProvider(state: ReturnType<typeof useAgentProcessingState>) {
  return useCallback((provider: ProcessingAgent, field: keyof AgentProviderSettings, value: string) => {
    state.setSaved(false);
    state.setSettings(current => ({ ...current, [provider]: { ...current[provider], [field]: normalize(value) } }));
  }, []);
}

/** Controls loading, editing, and saving machine-local agent processing preferences.
 *
 * @example const controller = useAgentProcessingController()
 */
export function useAgentProcessingController() {
  const state = useAgentProcessingState();
  const reload = useReload(state);
  const refreshOptions = useRefreshOptions(state);
  const save = useSave(state);
  const updateProcessor = useUpdateProcessor(state);
  const updateProvider = useUpdateProvider(state);
  useEffect(() => { void reload(); }, [reload]);
  return {
    error: state.error,
    loading: state.loading,
    options: state.options,
    refreshing: state.refreshing,
    refreshOptions,
    reload,
    save,
    saved: state.saved,
    saving: state.saving,
    settings: state.settings,
    updateProcessor,
    updateProvider
  };
}

export type AgentProcessingController = ReturnType<typeof useAgentProcessingController>;
