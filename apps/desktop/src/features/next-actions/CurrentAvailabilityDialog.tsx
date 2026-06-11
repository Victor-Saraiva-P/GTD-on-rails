import { useState } from "react";
import { ProcessingContextStep } from "../processing/ProcessingContextStep";
import { ProcessingEnergyStep } from "../processing/ProcessingEnergyStep";
import { ProcessingTimeStep } from "../processing/ProcessingTimeStep";

type CurrentAvailabilityDialogProps = Readonly<{
  contextIds: string[];
  energy: number | null;
  timeMinutes: number | null;
  onApply: (contextIds: string[], energy: number | null, timeMinutes: number | null) => void;
  onClose: () => void;
}>;

type CurrentAvailabilityStep = "context" | "energy" | "time";
type CurrentAvailabilityDraft = {
  contextIds: string[];
  energy: number | null;
  energyValue: string;
  timeValue: string;
};

function energyDigits(value: number | null): string {
  return value == null ? "" : Math.round(value * 10).toString();
}

function timeDigits(value: number | null): string {
  if (value == null) return "";
  return `${Math.floor(value / 60)}${(value % 60).toString().padStart(2, "0")}`;
}

function nextBackStep(step: CurrentAvailabilityStep): CurrentAvailabilityStep {
  return step === "time" ? "energy" : "context";
}

/**
 * Edits the volatile next-action Current Availability State.
 *
 * @example <CurrentAvailabilityDialog contextIds={[]} energy={null} timeMinutes={null} onApply={apply} onClose={close} />
 */
export function CurrentAvailabilityDialog(props: CurrentAvailabilityDialogProps) {
  const [step, setStep] = useState<CurrentAvailabilityStep>("context");
  const [contextIds, setContextIds] = useState(props.contextIds);
  const [energy, setEnergy] = useState(props.energy);
  const [energyValue, setEnergyValue] = useState(() => energyDigits(props.energy));
  const [timeValue, setTimeValue] = useState(() => timeDigits(props.timeMinutes));
  const draft = { contextIds, energy, energyValue, timeValue };
  const back = () => {
    if (step === "context") { props.onClose(); return; }
    setStep(nextBackStep(step));
  };
  const apply = (minutes: number | null) => props.onApply(contextIds, energy, minutes);

  return (
    <section className="processing-dialog processing-dialog--next-actions" role="dialog" aria-modal="true" aria-label="Current Availability">
      <div className="processing-dialog__title">Current Availability</div>
      <div className="processing-dialog__content">
        {renderCurrentAvailabilityStep(step, draft, setContextIds, setEnergy, setEnergyValue, setTimeValue, setStep, apply, back)}
      </div>
    </section>
  );
}

function renderCurrentAvailabilityStep(
  step: CurrentAvailabilityStep,
  draft: CurrentAvailabilityDraft,
  setContextIds: (contextIds: string[]) => void,
  setEnergy: (energy: number | null) => void,
  setEnergyValue: (value: string) => void,
  setTimeValue: (value: string) => void,
  setStep: (step: CurrentAvailabilityStep) => void,
  apply: (minutes: number | null) => void,
  back: () => void
) {
  if (step === "context") return <ProcessingContextStep initialSelectedIds={draft.contextIds} onSelectedIdsChange={setContextIds} onContextsSelected={(nextIds) => { setContextIds(nextIds); setStep("energy"); }} onBack={back} />;
  if (step === "energy") return <ProcessingEnergyStep digits={draft.energyValue} label="Available energy (0.0 - 10.0):" onDigitsChange={setEnergyValue} onEnergySelected={(nextEnergy) => { setEnergy(nextEnergy); setStep("time"); }} onBack={back} />;
  return <ProcessingTimeStep digits={draft.timeValue} label="Available time (h min):" onDigitsChange={setTimeValue} onTimeSelected={apply} onBack={back} />;
}
