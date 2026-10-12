import { useState, type KeyboardEvent } from "react";
import {
  interpretCurrentAvailabilityWithAgent,
  type CurrentAvailabilityInterpretation
} from "./currentAvailabilityAgent.ts";

type CurrentAvailabilityAgentDialogProps = Readonly<{
  currentEnergy: number | null;
  currentTimeMinutes: number | null;
  onApply: (energy: number, timeMinutes: number) => void;
  onClose: () => void;
}>;

type AvailabilityCheckInModel = Readonly<{
  description: string;
  errorMessage: string | null;
  isInterpreting: boolean;
  result: CurrentAvailabilityInterpretation | null;
  apply: () => void;
  interpret: () => Promise<void>;
  updateDescription: (value: string) => void;
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
    <div className="availability-agent-dialog__result">
      <div><strong>Energy</strong><span>{result.energy.toFixed(1)} / 10</span></div>
      <div><strong>Time</strong><span>{result.timeMinutes} min</span></div>
      <p>{result.rationale}</p>
    </div>
  );
}

async function requestAvailabilityInterpretation(
  description: string,
  setResult: (value: CurrentAvailabilityInterpretation | null) => void,
  setErrorMessage: (value: string | null) => void,
  setIsInterpreting: (value: boolean) => void
) {
  setIsInterpreting(true);
  setErrorMessage(null);
  try {
    setResult(await interpretCurrentAvailabilityWithAgent(description));
  } catch (error: unknown) {
    setResult(null);
    setErrorMessage(error instanceof Error ? error.message : "Failed to interpret current availability.");
  } finally {
    setIsInterpreting(false);
  }
}

function useAvailabilityCheckInModel(props: CurrentAvailabilityAgentDialogProps): AvailabilityCheckInModel {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<CurrentAvailabilityInterpretation | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const updateDescription = (value: string) => { setDescription(value); setResult(null); setErrorMessage(null); };
  const interpret = async () => {
    const text = description.trim();
    if (!text || isInterpreting) return;
    await requestAvailabilityInterpretation(text, setResult, setErrorMessage, setIsInterpreting);
  };
  const apply = () => {
    if (!result) return;
    props.onApply(result.energy, result.timeMinutes); props.onClose();
  };
  return { apply, description, errorMessage, interpret, isInterpreting, result, updateDescription };
}

function CapacityState(props: CurrentAvailabilityAgentDialogProps & Readonly<{ result: CurrentAvailabilityInterpretation | null }>) {
  return (
    <div className="availability-agent-dialog__state" aria-live="polite">
      <span>Current: {currentCapacityLabel(props.currentEnergy, props.currentTimeMinutes)}</span>
      <span>Candidate: {candidateCapacityLabel(props.result)}</span>
      <span>Storage: local to this device</span>
    </div>
  );
}

function DialogActions(props: Readonly<{ model: AvailabilityCheckInModel; onClose: () => void }>) {
  const disabled = !props.model.description.trim() || props.model.isInterpreting;
  return (
    <div className="availability-agent-dialog__actions">
      <button type="button" onClick={props.onClose}>Cancel</button>
      <button type="button" disabled={disabled} onClick={() => void props.model.interpret()}>
        {props.model.isInterpreting ? "Interpreting..." : "Interpret"}
      </button>
      <button type="button" disabled={!props.model.result || props.model.isInterpreting} onClick={props.model.apply}>Apply availability</button>
    </div>
  );
}

function closeAvailabilityDialogOnEscape(event: KeyboardEvent<HTMLDialogElement>, onClose: () => void) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  onClose();
}

/**
 * Collects a natural-language check-in and previews the configured agent's availability interpretation.
 *
 * @example <CurrentAvailabilityAgentDialog currentEnergy={5} currentTimeMinutes={30} onApply={apply} onClose={close} />
 */
export function CurrentAvailabilityAgentDialog(props: CurrentAvailabilityAgentDialogProps) {
  const model = useAvailabilityCheckInModel(props);
  return (
    <div className="availability-agent-dialog__backdrop">
      <dialog className="availability-agent-dialog" aria-label="Availability check-in" onKeyDown={(event) => closeAvailabilityDialogOnEscape(event, props.onClose)} open>
        <header><span>Availability check-in</span><kbd>esc</kbd></header>
        <p>Tell the configured agent how you feel and how much usable time you have.</p>
        <textarea autoFocus className="availability-agent-dialog__textarea" maxLength={4000} value={model.description} onChange={(event) => model.updateDescription(event.target.value)} placeholder="Describe how you're feeling and how much time you have..." />
        {model.result ? <InterpretationResult result={model.result} /> : null}
        {model.errorMessage ? <p className="availability-agent-dialog__error" role="alert">{model.errorMessage}</p> : null}
        <CapacityState {...props} result={model.result} />
        <DialogActions model={model} onClose={props.onClose} />
      </dialog>
    </div>
  );
}
