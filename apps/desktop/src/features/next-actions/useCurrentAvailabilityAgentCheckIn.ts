import { useCallback, useState } from "react";
import {
  interpretCurrentAvailabilityWithAgent,
  type CurrentAvailabilityInterpretation
} from "./currentAvailabilityAgent.ts";

export type CurrentAvailabilityAgentStatus = "idle" | "interpreting" | "ready" | "error";

export type CurrentAvailabilityAgentCheckIn = Readonly<{
  description: string;
  errorMessage: string | null;
  result: CurrentAvailabilityInterpretation | null;
  status: CurrentAvailabilityAgentStatus;
  apply: () => void;
  interpret: () => Promise<void>;
  setDescription: (value: string) => void;
}>;

/** Keeps one availability interpretation alive while AppShell navigates between screens.
 *
 * @example const checkIn = useCurrentAvailabilityAgentCheckIn(applyCapacity)
 */
export function useCurrentAvailabilityAgentCheckIn(
  applyCapacity: (energy: number, timeMinutes: number) => void
): CurrentAvailabilityAgentCheckIn {
  const [description, setDescriptionState] = useState("");
  const [result, setResult] = useState<CurrentAvailabilityInterpretation | null>(null);
  const [status, setStatus] = useState<CurrentAvailabilityAgentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setDescription = useCallback((value: string) => {
    setDescriptionState(value);
    setResult(null);
    setErrorMessage(null);
    setStatus("idle");
  }, []);

  const interpret = useCallback(async () => {
    const text = description.trim();
    if (!text || status === "interpreting") return;
    setStatus("interpreting");
    setResult(null);
    setErrorMessage(null);
    try {
      const interpretation = await interpretCurrentAvailabilityWithAgent(text);
      setResult(interpretation);
      setStatus("ready");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to interpret current availability.");
      setStatus("error");
    }
  }, [description, status]);

  const apply = useCallback(() => {
    if (!result) return;
    applyCapacity(result.energy, result.timeMinutes);
    setDescriptionState("");
    setResult(null);
    setErrorMessage(null);
    setStatus("idle");
  }, [applyCapacity, result]);

  return { apply, description, errorMessage, interpret, result, setDescription, status };
}
