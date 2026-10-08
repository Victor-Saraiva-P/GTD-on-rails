import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../../lib/tauriRuntime.ts";
import type { AvailabilityEnvironmentSignals } from "./types.ts";

/** Reads current device and physical NetworkManager signals from the native desktop shell.
 *
 * @example const signals = await fetchAvailabilityEnvironmentSignals()
 */
export async function fetchAvailabilityEnvironmentSignals(): Promise<AvailabilityEnvironmentSignals> {
  if (!isTauriRuntime()) {
    throw new Error("availability environment runtime value 'browser' is invalid; expected native Tauri desktop runtime");
  }
  return invoke<AvailabilityEnvironmentSignals>("availability_environment_signals");
}
