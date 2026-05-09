import { useRef, useState } from "react";
import type { Stuff } from "../inbox/types";
import type { ContextItem } from "../contexts/types";
import { ProcessingInitialStep } from "./ProcessingInitialStep";
import { ProcessingContextStep } from "./ProcessingContextStep";
import { ProcessingEnergyStep } from "./ProcessingEnergyStep";
import { ProcessingTimeStep } from "./ProcessingTimeStep";

type ProcessingDialogProps = {
  item: Stuff;
  onClose: () => void;
  onProcess: (energy: number | null, estimatedTimeMinutes: number | null, contextId: string) => void;
};

type ProcessingStep = 'initial' | 'select-context' | 'set-energy' | 'set-time';

/**
 * Shows the processing command wizard for the selected stuff.
 *
 * @example <ProcessingDialog item={stuff} onClose={close} onProcess={process} />
 */
export function ProcessingDialog({ item, onClose, onProcess }: ProcessingDialogProps) {
  const [step, setStep] = useState<ProcessingStep>('initial');
  const [selectedContext, setSelectedContext] = useState<ContextItem | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<number | null>(null);
  const selectedContextRef = useRef<ContextItem | null>(null);
  const selectedEnergyRef = useRef<number | null>(null);

  const handleNextAction = () => {
    setStep('select-context');
  };

  const handleContextSelected = (context: ContextItem) => {
    selectedContextRef.current = context;
    setSelectedContext(context);
    setStep('set-energy');
  };

  const handleEnergySelected = (energy: number | null) => {
    selectedEnergyRef.current = energy;
    setSelectedEnergy(energy);
    setStep('set-time');
  };

  const handleTimeSelected = (minutes: number | null) => {
    const context = selectedContextRef.current ?? selectedContext;
    const energy = selectedEnergyRef.current ?? selectedEnergy;

    if (context) {
      onProcess(energy, minutes, context.id);
    } else {
      onClose();
    }
  };

  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Processing">
      <div className="processing-dialog__title">Processing</div>
      <div className="processing-dialog__content">
        {step === 'initial' && (
          <ProcessingInitialStep onNextAction={handleNextAction} onCancel={onClose} />
        )}
        {step === 'select-context' && (
          <ProcessingContextStep onContextSelected={handleContextSelected} onCancel={onClose} />
        )}
        {step === 'set-energy' && (
          <ProcessingEnergyStep onEnergySelected={handleEnergySelected} onCancel={onClose} />
        )}
        {step === 'set-time' && (
          <ProcessingTimeStep onTimeSelected={handleTimeSelected} onCancel={onClose} />
        )}
      </div>
    </section>
  );
}
