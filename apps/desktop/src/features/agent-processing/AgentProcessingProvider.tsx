import { listen } from "@tauri-apps/api/event";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type PropsWithChildren, type SetStateAction } from "react";
import { isTauriRuntime } from "../../lib/tauriRuntime";
import { startAgentProcessing } from "./native";
import type { AgentProcessingFinished, AgentProcessingProgress, AgentProcessingRun, TrackedAgentProcessingRun } from "./types";

type AgentProcessingContextValue = {
  runs: TrackedAgentProcessingRun[];
  activeRuns: TrackedAgentProcessingRun[];
  revision: number;
  start: (stuffId: string, stuffTitle: string) => Promise<void>;
  runForStuff: (stuffId: string) => TrackedAgentProcessingRun | null;
};

const AgentProcessingContext = createContext<AgentProcessingContextValue | null>(null);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error) || "Agent processing could not be started.";
}

function startingRun(stuffId: string, stuffTitle: string): TrackedAgentProcessingRun {
  return {
    runId: null,
    stuffId,
    stuffTitle,
    provider: null,
    model: null,
    thinking: null,
    processId: null,
    logPath: null,
    state: "starting",
    activity: "Starting configured agent",
    startedAt: Date.now(),
    finishedAt: null,
    denied: false,
    response: null
  };
}

function runningRun(starting: TrackedAgentProcessingRun, run: AgentProcessingRun): TrackedAgentProcessingRun {
  return {
    ...starting,
    ...run,
    state: "running",
    activity: "Agent started; waiting for GTD activity"
  };
}

function isActive(run: TrackedAgentProcessingRun | undefined): boolean {
  return run?.state === "starting" || run?.state === "running";
}

/** Keeps headless agent runs observable across page and stuff navigation.
 *
 * @example <AgentProcessingProvider><AppShell /></AgentProcessingProvider>
 */
export function AgentProcessingProvider({ children }: PropsWithChildren) {
  const [runsByStuff, setRunsByStuff] = useState<Record<string, TrackedAgentProcessingRun>>({});
  const [revision, setRevision] = useState(0);
  const runsRef = useRef(runsByStuff);

  const replaceRun = useCallback((stuffId: string, run: TrackedAgentProcessingRun) => {
    const next = { ...runsRef.current, [stuffId]: run };
    runsRef.current = next;
    setRunsByStuff(next);
  }, []);

  const start = useCallback(async (stuffId: string, stuffTitle: string) => {
    if (isActive(runsRef.current[stuffId])) return;
    const pending = startingRun(stuffId, stuffTitle);
    replaceRun(stuffId, pending);
    try {
      const run = await startAgentProcessing(stuffId, stuffTitle);
      replaceRun(stuffId, runningRun(pending, run));
    } catch (error) {
      replaceRun(stuffId, { ...pending, state: "failed", activity: errorMessage(error), finishedAt: Date.now() });
    }
  }, [replaceRun]);

  useAgentEvents(runsRef, replaceRun, setRevision);
  const runs = useMemo(() => Object.values(runsByStuff).sort((left, right) => right.startedAt - left.startedAt), [runsByStuff]);
  const activeRuns = useMemo(() => runs.filter(isActive), [runs]);
  const value = useMemo<AgentProcessingContextValue>(() => ({
    runs,
    activeRuns,
    revision,
    start,
    runForStuff: (stuffId) => runsByStuff[stuffId] ?? null
  }), [activeRuns, revision, runs, runsByStuff, start]);

  return <AgentProcessingContext.Provider value={value}>{children}</AgentProcessingContext.Provider>;
}

function useAgentEvents(
  runsRef: MutableRefObject<Record<string, TrackedAgentProcessingRun>>,
  replaceRun: (stuffId: string, run: TrackedAgentProcessingRun) => void,
  setRevision: Dispatch<SetStateAction<number>>
) {
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const progress = listen<AgentProcessingProgress>("agent-processing-progress", event => {
      const current = runsRef.current[event.payload.stuffId];
      if (!current || current.runId !== event.payload.runId) return;
      replaceRun(current.stuffId, { ...current, activity: event.payload.message });
    });
    const finished = listen<AgentProcessingFinished>("agent-processing-finished", event => {
      const current = runsRef.current[event.payload.stuffId];
      if (!current || current.runId !== event.payload.runId) return;
      replaceRun(current.stuffId, finishRun(current, event.payload));
      setRevision(value => value + 1);
    });
    return () => {
      void progress.then(dispose => dispose());
      void finished.then(dispose => dispose());
    };
  }, [replaceRun, runsRef, setRevision]);
}

function finishRun(current: TrackedAgentProcessingRun, result: AgentProcessingFinished): TrackedAgentProcessingRun {
  const completed = { ...current, response: result.response, finishedAt: Date.now() };
  if (result.processed) return { ...completed, state: "processed", activity: "Stuff processed successfully" };
  if (result.denied) return { ...completed, state: "failed", denied: true, activity: "Agent permission was denied" };
  if (!result.success) return { ...completed, state: "failed", activity: "Agent process failed; inspect the run log" };
  return { ...completed, state: "finished", activity: "Agent finished without processing the stuff" };
}

/** Accesses global headless-agent run state and actions.
 *
 * @example const { start, runForStuff } = useAgentProcessing()
 */
export function useAgentProcessing(): AgentProcessingContextValue {
  const context = useContext(AgentProcessingContext);
  if (!context) throw new Error("useAgentProcessing must be used inside AgentProcessingProvider.");
  return context;
}
