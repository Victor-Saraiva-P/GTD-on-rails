import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../../lib/tauriRuntime.ts";

export type CurrentAvailabilityInterpretation = {
  energy: number;
  timeMinutes: number;
  rationale: string;
};

/** Uses the configured local processing agent to interpret a natural-language availability check-in.
 *
 * @example await interpretCurrentAvailabilityWithAgent("Tired, with 40 minutes before my meeting.")
 */
export async function interpretCurrentAvailabilityWithAgent(description: string): Promise<CurrentAvailabilityInterpretation> {
  if (!isTauriRuntime()) throw new Error("Availability check-in requires the native desktop runtime.");
  return invoke<CurrentAvailabilityInterpretation>("interpret_current_availability", { description });
}
