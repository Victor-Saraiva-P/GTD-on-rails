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
type CurrentAvailabilityRenderModel = {
  apply: (minutes: number | null) => void;
  back: () => void;
  draft: CurrentAvailabilityDraft;
  setContextIds: (contextIds: string[]) => void;
  setEnergy: (energy: number | null) => void;
  setEnergyValue: (value: string) => void;
  setStep: (step: CurrentAvailabilityStep) => void;
  setTimeValue: (value: string) => void;
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
  const model = { apply, back, draft, setContextIds, setEnergy, setEnergyValue, setStep, setTimeValue };

  return (
    <dialog className="processing-dialog processing-dialog--next-actions" aria-label="Current Availability" open>
      <div className="processing-dialog__title">Current Availability</div>
      <div className="processing-dialog__content">
        {renderCurrentAvailabilityStep(step, model)}
      </div>
    </dialog>
  );
}

function renderCurrentAvailabilityStep(step: CurrentAvailabilityStep, model: CurrentAvailabilityRenderModel) {
  if (step === "context") return <ProcessingContextStep initialSelectedIds={model.draft.contextIds} onSelectedIdsChange={model.setContextIds} onContextsSelected={(nextIds) => { model.setContextIds(nextIds); model.setStep("energy"); }} onBack={model.back} />;
  if (step === "energy") return <ProcessingEnergyStep digits={model.draft.energyValue} label="Available energy (0.0 - 10.0):" onDigitsChange={model.setEnergyValue} onEnergySelected={(nextEnergy) => { model.setEnergy(nextEnergy); model.setStep("time"); }} onBack={model.back} />;
  return <ProcessingTimeStep digits={model.draft.timeValue} label="Available time (h min):" onDigitsChange={model.setTimeValue} onTimeSelected={model.apply} onBack={model.back} />;
}
