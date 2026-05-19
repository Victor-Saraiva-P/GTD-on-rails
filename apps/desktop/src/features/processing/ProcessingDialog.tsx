import { useState } from "react";
import type { Stuff } from "../inbox/types";
import { ProcessingInitialStep } from "./ProcessingInitialStep";
import { ProcessingContextStep } from "./ProcessingContextStep";
import { ProcessingEnergyStep } from "./ProcessingEnergyStep";
import { ProcessingTimeStep } from "./ProcessingTimeStep";

type ProcessingDialogProps = {
  item: Stuff;
  onClose: () => void;
  onProcess: (energy: number | null, estimatedTimeMinutes: number | null, contextIds: string[]) => void;
};

type ProcessingStep = "initial" | "select-context" | "set-energy" | "set-time";

function previousProcessingStep(step: ProcessingStep): ProcessingStep {
  if (step === "set-time") return "set-energy";
  if (step === "set-energy") return "select-context";
  return "initial";
}

/**
 * Shows the processing command wizard for the selected stuff.
 *
 * @example <ProcessingDialog item={stuff} onClose={close} onProcess={process} />
 */
export function ProcessingDialog({ item, onClose, onProcess }: ProcessingDialogProps) {
  const [step, setStep] = useState<ProcessingStep>("initial");
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [selectedEnergyDigits, setSelectedEnergyDigits] = useState("");
  const [selectedTimeDigits, setSelectedTimeDigits] = useState("");

  const handleNextAction = () => {
    setStep("select-context");
  };

  const handleContextsSelected = (contextIds: string[]) => {
    setSelectedContextIds(contextIds);
    setStep("set-energy");
  };

  const handleEnergySelected = (energy: number | null) => {
    setStep("set-time");
  };

  const handleTimeSelected = (minutes: number | null) => {
    const energy = selectedEnergyDigits ? parseInt(selectedEnergyDigits, 10) / 10 : null;
    onProcess(energy, minutes, selectedContextIds);
  };

  const handleBack = () => setStep((currentStep) => previousProcessingStep(currentStep));

  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Processing">
      <div className="processing-dialog__title">Processing</div>
      <div className="processing-dialog__content">
        {step === "initial" && (
          <ProcessingInitialStep onNextAction={handleNextAction} onCancel={onClose} />
        )}
        {step === "select-context" && (
          <ProcessingContextStep onContextsSelected={handleContextsSelected} onSelectedIdsChange={setSelectedContextIds} onBack={handleBack} initialSelectedIds={selectedContextIds} />
        )}
        {step === "set-energy" && (
          <ProcessingEnergyStep digits={selectedEnergyDigits} onDigitsChange={setSelectedEnergyDigits} onEnergySelected={handleEnergySelected} onBack={handleBack} />
        )}
        {step === "set-time" && (
          <ProcessingTimeStep digits={selectedTimeDigits} onDigitsChange={setSelectedTimeDigits} onTimeSelected={handleTimeSelected} onBack={handleBack} />
        )}
      </div>
    </section>
  );
}
