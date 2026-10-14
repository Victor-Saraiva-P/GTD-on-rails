import { invoke } from "@tauri-apps/api/core";
import type { AgentActivity } from "../agent-processing/types.ts";
import { isTauriRuntime } from "../../lib/tauriRuntime.ts";

export type CurrentAvailabilityInterpretation = {
  energy: number;
  timeMinutes: number;
  rationale: string;
};

export type CurrentAvailabilityAgentProgress = AgentActivity & {
  runId: string;
};

/** Uses the configured local processing agent to interpret a natural-language availability check-in.
 *
 * @example await interpretCurrentAvailabilityWithAgent("Tired, with 40 minutes before my meeting.")
 */
export async function interpretCurrentAvailabilityWithAgent(description: string, runId: string): Promise<CurrentAvailabilityInterpretation> {
  if (!isTauriRuntime()) throw new Error("Availability check-in requires the native desktop runtime.");
  return invoke<CurrentAvailabilityInterpretation>("interpret_current_availability", { description, runId });
}
