import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { appendAgentActivity } from "../agent-processing/activity.ts";
import type { AgentActivity } from "../agent-processing/types.ts";
import { isTauriRuntime } from "../../lib/tauriRuntime.ts";
import {
  interpretCurrentAvailabilityWithAgent,
  type CurrentAvailabilityAgentProgress,
  type CurrentAvailabilityInterpretation
} from "./currentAvailabilityAgent.ts";

export type CurrentAvailabilityAgentStatus = "idle" | "interpreting" | "ready" | "error";

export type CurrentAvailabilityAgentCheckIn = Readonly<{
  activities: AgentActivity[];
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
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const activeRunId = useRef<string | null>(null);
  const runSequence = useRef(0);

  const setDescription = useCallback((value: string) => {
    setDescriptionState(value);
    setResult(null);
    setErrorMessage(null);
    setActivities([]);
    setStatus("idle");
  }, []);

  const interpret = useCallback(async () => {
    const text = description.trim();
    if (!text || status === "interpreting") return;
    const runId = `${Date.now()}-${++runSequence.current}`;
    activeRunId.current = runId;
    setStatus("interpreting");
    setResult(null);
    setErrorMessage(null);
    setActivities([{ kind: "status", message: "Starting configured agent" }]);
    try {
      const interpretation = await interpretCurrentAvailabilityWithAgent(text, runId);
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
    setActivities([]);
    setStatus("idle");
  }, [applyCapacity, result]);

  useAvailabilityProgress(activeRunId, setActivities);
  return { activities, apply, description, errorMessage, interpret, result, setDescription, status };
}

function useAvailabilityProgress(
  activeRunId: MutableRefObject<string | null>,
  setActivities: Dispatch<SetStateAction<AgentActivity[]>>
) {
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const subscription = listen<CurrentAvailabilityAgentProgress>("availability-agent-progress", event => {
      if (event.payload.runId !== activeRunId.current) return;
      setActivities(entries => appendAgentActivity(entries, event.payload));
    }).catch(() => null);
    return () => { void subscription.then(unlisten => unlisten?.()); };
  }, [activeRunId, setActivities]);
}
