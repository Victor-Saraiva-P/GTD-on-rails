import { useCallback, useState } from "react";
import type { AvailabilityEnvironmentSignals } from "./types";

export type AvailabilityEnvironmentReader = () => Promise<AvailabilityEnvironmentSignals>;

export type AvailabilityEnvironmentState = {
  error: string | null;
  refresh: () => Promise<AvailabilityEnvironmentSignals | null>;
  signals: AvailabilityEnvironmentSignals | null;
};

export type AvailabilityEnvironmentReadResult = {
  error: string | null;
  signals: AvailabilityEnvironmentSignals | null;
};

/** Reads availability signals through an injected native environment reader.
 *
 * @example const environment = useAvailabilityEnvironment(fetchAvailabilityEnvironmentSignals)
 */
export function useAvailabilityEnvironment(reader: AvailabilityEnvironmentReader): AvailabilityEnvironmentState {
  const [signals, setSignals] = useState<AvailabilityEnvironmentSignals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const result = await readAvailabilityEnvironment(reader);
    setSignals(result.signals);
    setError(result.error);
    return result.signals;
  }, [reader]);
  return { error, refresh, signals };
}

/** Executes one injected environment read and normalizes failures into an explicit unavailable state.
 *
 * @example const result = await readAvailabilityEnvironment(fakeReader)
 */
export async function readAvailabilityEnvironment(reader: AvailabilityEnvironmentReader): Promise<AvailabilityEnvironmentReadResult> {
  try {
    return { signals: await reader(), error: null };
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Failed to detect automatic availability signals";
    return { signals: null, error };
  }
}
