import { useLayoutEffect, useRef, useState } from "react";
import { ProcessingContextStep } from "../processing/ProcessingContextStep";
import { ProcessingEnergyStep } from "../processing/ProcessingEnergyStep";
import { ProcessingTimeStep } from "../processing/ProcessingTimeStep";
import type { NextAction, NextActionPatch } from "./types";

type NextActionEditDialogProps = {
  item: NextAction;
  onSave: (patch: NextActionPatch) => Promise<void>;
  onClose: () => void;
};

type NextActionEditStep = "initial" | "context" | "energy" | "time";

type CommandKeyEvent = {
  key: string;
  preventDefault: () => void;
  stopPropagation: () => void;
};

function initialContextIds(item: NextAction): string[] {
  return item.contexts?.map((context) => context.id) ?? [];
}

function estimatedTimePatch(minutes: number | null): NextActionPatch {
  if (minutes == null) return { estimatedTime: null };
  return { estimatedTime: { hours: Math.floor(minutes / 60), minutes: minutes % 60 } };
}

function NextActionEditInitialStep(props: { onSelect: (step: NextActionEditStep) => void; onCancel: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => containerRef.current?.focus(), []);
  useLayoutEffect(() => {
    const listener = (event: KeyboardEvent) => handleInitialKey(event, props.onSelect, props.onCancel);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [props.onSelect, props.onCancel]);

  return (
    <div ref={containerRef} className="processing-dialog__step processing-dialog__step--initial" tabIndex={-1}>
      <EditCommand shortcut="e" label="Energy" />
      <EditCommand shortcut="c" label="Context" />
      <EditCommand shortcut="t" label="Estimated time" />
    </div>
  );
}

function handleInitialKey(event: CommandKeyEvent, onSelect: (step: NextActionEditStep) => void, onCancel: () => void) {
  if (event.key === "Escape") return cancelKey(event, onCancel);
  const selectedStep = keyToStep(event.key);
  if (selectedStep) selectKey(event, () => onSelect(selectedStep));
}

function EditCommand({ shortcut, label }: { shortcut: string; label: string }) {
  return <button className="processing-dialog__command" type="button"><kbd>{shortcut}</kbd><span>{label}</span></button>;
}

function renderContextStep(item: NextAction, savePatch: (patch: NextActionPatch) => void, onClose: () => void) {
  return <ProcessingContextStep initialSelectedIds={initialContextIds(item)} onContextsSelected={(contextIds) => savePatch({ contextIds })} onCancel={onClose} />;
}

function renderEnergyStep(savePatch: (patch: NextActionPatch) => void, onClose: () => void) {
  return <ProcessingEnergyStep onEnergySelected={(energy) => savePatch({ energy })} onCancel={onClose} />;
}

function renderTimeStep(savePatch: (patch: NextActionPatch) => void, onClose: () => void) {
  return <ProcessingTimeStep onTimeSelected={(minutes) => savePatch(estimatedTimePatch(minutes))} onCancel={onClose} />;
}

function keyToStep(key: string): NextActionEditStep | null {
  if (key.toLowerCase() === "e") return "energy";
  if (key.toLowerCase() === "c") return "context";
  if (key.toLowerCase() === "t") return "time";
  return null;
}

function cancelKey(event: CommandKeyEvent, onCancel: () => void) {
  event.preventDefault();
  event.stopPropagation();
  onCancel();
}

function selectKey(event: CommandKeyEvent, onSelect: () => void) {
  event.preventDefault();
  event.stopPropagation();
  onSelect();
}

/**
 * Edits one selected next action attribute through the keyboard processing flow.
 *
 * @example <NextActionEditDialog item={item} onSave={savePatch} onClose={close} />
 */
export function NextActionEditDialog({ item, onSave, onClose }: NextActionEditDialogProps) {
  const [step, setStep] = useState<NextActionEditStep>("initial");
  const savePatch = (patch: NextActionPatch) => void onSave(patch);

  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Edit next action">
      <div className="processing-dialog__title">Edit Next Action</div>
      <div className="processing-dialog__content">
        {step === "initial" ? <NextActionEditInitialStep onSelect={setStep} onCancel={onClose} /> : null}
        {step === "context" ? renderContextStep(item, savePatch, onClose) : null}
        {step === "energy" ? renderEnergyStep(savePatch, onClose) : null}
        {step === "time" ? renderTimeStep(savePatch, onClose) : null}
      </div>
    </section>
  );
}
