import type { RefObject } from "react";
import type { CurrentAvailabilityInterpretation } from "./currentAvailabilityAgent.ts";
import type { CurrentAvailabilityAgentCheckIn } from "./useCurrentAvailabilityAgentCheckIn.ts";

type CurrentAvailabilityAgentPanelProps = Readonly<{
  currentEnergy: number | null;
  currentTimeMinutes: number | null;
  checkIn: CurrentAvailabilityAgentCheckIn;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}>;

function currentCapacityLabel(energy: number | null, timeMinutes: number | null): string {
  const time = timeMinutes == null ? "any time" : `${timeMinutes} min`;
  const energyLabel = energy == null ? "any energy" : `${energy.toFixed(1)} energy`;
  return `${time} / ${energyLabel}`;
}

function candidateCapacityLabel(result: CurrentAvailabilityInterpretation | null): string {
  return result ? `${result.timeMinutes} min / ${result.energy.toFixed(1)} energy` : "not interpreted yet";
}

function InterpretationResult({ result }: Readonly<{ result: CurrentAvailabilityInterpretation }>) {
  return (
    <div className="availability-agent-panel__result">
      <div><strong>Energy</strong><span>{result.energy.toFixed(1)} / 10</span></div>
      <div><strong>Time</strong><span>{result.timeMinutes} min</span></div>
      <p>{result.rationale}</p>
    </div>
  );
}

function CapacityState(props: Readonly<{
  currentEnergy: number | null;
  currentTimeMinutes: number | null;
  result: CurrentAvailabilityInterpretation | null;
}>) {
  return (
    <div className="availability-agent-panel__state" aria-live="polite">
      <span>Current: {currentCapacityLabel(props.currentEnergy, props.currentTimeMinutes)}</span>
      <span>Candidate: {candidateCapacityLabel(props.result)}</span>
      <span>Storage: local to this device</span>
    </div>
  );
}

function statusCopy(checkIn: CurrentAvailabilityAgentCheckIn) {
  if (checkIn.status === "interpreting") return <p className="availability-agent-panel__muted">Agent is interpreting your current energy and usable time. You can keep navigating while this runs.</p>;
  if (checkIn.status === "error") return <p className="availability-agent-panel__error" role="alert">{checkIn.errorMessage}</p>;
  if (checkIn.result) return <InterpretationResult result={checkIn.result} />;
  return <p className="availability-agent-panel__muted">Describe how you feel and how much usable time you have. The configured processing agent will estimate both values for review.</p>;
}

/**
 * Next Actions Current Availability drawer backed by AppShell-scoped check-in state.
 *
 * @example <CurrentAvailabilityAgentPanel currentEnergy={5} currentTimeMinutes={30} checkIn={checkIn} inputRef={inputRef} />
 */
export function CurrentAvailabilityAgentPanel(props: CurrentAvailabilityAgentPanelProps) {
  const interpreting = props.checkIn.status === "interpreting";
  return (
    <aside className="availability-agent-panel" aria-label="Availability check-in">
      <header>
        <strong>Check in with your agent</strong>
        <span className={`availability-agent-panel__status availability-agent-panel__status--${props.checkIn.status}`}>
          {props.checkIn.status}
        </span>
      </header>
      <CapacityState currentEnergy={props.currentEnergy} currentTimeMinutes={props.currentTimeMinutes} result={props.checkIn.result} />
      <textarea
        ref={props.inputRef}
        className="availability-agent-panel__textarea"
        value={props.checkIn.description}
        disabled={interpreting}
        onChange={(event) => props.checkIn.setDescription(event.target.value)}
        placeholder="Describe how you're feeling and how much time you have..."
      />
      <button
        className="availability-agent-panel__primary"
        type="button"
        disabled={!props.checkIn.description.trim() || interpreting}
        onClick={() => void props.checkIn.interpret()}
      >
        {interpreting ? "Interpreting..." : "Interpret my situation"}
      </button>
      {statusCopy(props.checkIn)}
      <button
        className="availability-agent-panel__apply"
        type="button"
        disabled={!props.checkIn.result || interpreting}
        onClick={props.checkIn.apply}
      >
        Use this availability
      </button>
    </aside>
  );
}
