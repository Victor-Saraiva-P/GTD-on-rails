import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../../lib/tauriRuntime";
import type { AgentProcessingOptions, AgentProcessingRun, AgentProcessingSettings } from "./types";

const browserSettings: AgentProcessingSettings = {
  processor: "antigravity",
  antigravity: { model: null, thinking: null },
  codex: { model: null, thinking: null }
};

const browserOptions: AgentProcessingOptions = {
  antigravity: { available: false, models: [], thinking: ["low", "medium", "high", "xhigh", "max"] },
  codex: { available: false, models: [], thinking: ["low", "medium", "high", "xhigh", "max"] }
};

/** Loads machine-local agent processing preferences from the native desktop runtime.
 *
 * @example await loadAgentProcessingSettings()
 */
export async function loadAgentProcessingSettings(): Promise<AgentProcessingSettings> {
  if (!isTauriRuntime()) return browserSettings;
  return invoke<AgentProcessingSettings>("agent_processing_settings");
}

/** Loads locally available model and thinking choices for supported headless agents.
 *
 * @example await loadAgentProcessingOptions()
 */
export async function loadAgentProcessingOptions(refresh = false): Promise<AgentProcessingOptions> {
  if (!isTauriRuntime()) return browserOptions;
  return invoke<AgentProcessingOptions>("agent_processing_options", { refresh });
}

/** Persists machine-local settings used by future headless GTD processing runs.
 *
 * @example await saveAgentProcessingSettings(settings)
 */
export async function saveAgentProcessingSettings(settings: AgentProcessingSettings): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("save_agent_processing_settings", { settings });
}

/** Starts a headless processing run for one inbox stuff item using the saved agent settings.
 *
 * @example await startAgentProcessing(stuff.id, stuff.title)
 */
export async function startAgentProcessing(stuffId: string, stuffTitle: string): Promise<AgentProcessingRun> {
  if (!isTauriRuntime()) throw new Error("Agent processing requires the native desktop runtime.");
  return invoke<AgentProcessingRun>("start_agent_processing", { stuffId, stuffTitle });
}
