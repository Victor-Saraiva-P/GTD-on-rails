import { useEffect, useState } from "react";
import { useAgentProcessing } from "./AgentProcessingProvider";
import type { TrackedAgentProcessingRun } from "./types";

function useClock(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [active]);
  return now;
}

function elapsedLabel(run: TrackedAgentProcessingRun, now: number): string {
  const end = run.finishedAt ?? now;
  const seconds = Math.max(0, Math.floor((end - run.startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function providerLabel(run: TrackedAgentProcessingRun): string {
  if (!run.provider) return "configured agent";
  return run.provider === "antigravity" ? "Antigravity" : "Codex";
}

function runTone(run: TrackedAgentProcessingRun): string {
  if (run.state === "processed") return "success";
  if (run.state === "failed") return "error";
  if (run.state === "finished") return "warning";
  return "active";
}

function runConfiguration(run: TrackedAgentProcessingRun): string {
  const values = [providerLabel(run), run.model ?? "CLI default model", run.thinking ? `${run.thinking} thinking` : "CLI default thinking"];
  if (run.processId) values.push(`PID ${run.processId}`);
  return values.join(" · ");
}

/** Shows the current or most recent agent run for one inbox stuff item.
 *
 * @example <AgentProcessingStuffStatus stuffId={stuff.id} />
 */
export function AgentProcessingStuffStatus({ stuffId }: Readonly<{ stuffId: string }>) {
  const { runForStuff } = useAgentProcessing();
  const run = runForStuff(stuffId);
  const active = run?.state === "starting" || run?.state === "running";
  const now = useClock(active);
  if (!run) return null;

  return (
    <div className={`agent-run agent-run--${runTone(run)}`} aria-live="polite">
      <div className="agent-run__headline">
        <span className="agent-run__state">{run.state}</span>
        <span>{run.activity}</span>
        <span className="agent-run__elapsed">{elapsedLabel(run, now)}</span>
      </div>
      <div className="agent-run__meta">{runConfiguration(run)}</div>
      {run.response ? <div className="agent-run__response">{run.response}</div> : null}
      {run.logPath ? <div className="agent-run__log" title={run.logPath}>log: {run.logPath}</div> : null}
    </div>
  );
}

/** Shows active agent work in the shared application footer across page navigation.
 *
 * @example <AgentProcessingFooterStatus />
 */
export function AgentProcessingFooterStatus() {
  const { activeRuns } = useAgentProcessing();
  const now = useClock(activeRuns.length > 0);
  if (activeRuns.length === 0) return null;
  const primary = activeRuns[0];
  const title = activeRuns.map(run => `${run.stuffTitle}: ${run.activity} (${providerLabel(run)}, ${elapsedLabel(run, now)})`).join("\n");
  return (
    <div className="agent-run-footer" title={title} aria-label={`${activeRuns.length} agent processing run${activeRuns.length === 1 ? "" : "s"} active`}>
      <span className="agent-run-footer__pulse" aria-hidden="true" />
      <span>{activeRuns.length === 1 ? "AGENT" : `AGENTS ${activeRuns.length}`}</span>
      <span className="agent-run-footer__title">{primary.stuffTitle}</span>
      <span className="agent-run-footer__activity">{primary.activity}</span>
      <span>{elapsedLabel(primary, now)}</span>
    </div>
  );
}
