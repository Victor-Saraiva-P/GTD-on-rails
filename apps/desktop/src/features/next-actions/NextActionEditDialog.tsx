import { useLayoutEffect, useRef, useState } from "react";
import { ProcessingContextStep } from "../processing/ProcessingContextStep";
import { ProcessingEnergyStep } from "../processing/ProcessingEnergyStep";
import { ProcessingTimeStep } from "../processing/ProcessingTimeStep";
import { NextActionDeadlineStep } from "./NextActionDeadlineStep";
import type { NextAction, NextActionPatch } from "./types";

type NextActionEditDialogProps = Readonly<{
  item: NextAction;
  onSave: (patch: NextActionPatch) => Promise<void>;
  onClose: () => void;
}>;

type NextActionEditStep = "initial" | "context" | "deadline" | "energy" | "time";

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

function initialEnergyDigits(item: NextAction): string {
  return item.energy == null ? "" : Math.round(item.energy * 10).toString();
}

function initialTimeDigits(item: NextAction): string {
  if (!item.estimatedTime) return "";
  const minutes = item.estimatedTime.minutes.toString().padStart(2, "0");
  return `${item.estimatedTime.hours}${minutes}`;
}

function NextActionEditInitialStep(props: Readonly<{ onSelect: (step: NextActionEditStep) => void; onCancel: () => void }>) {
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
      <EditCommand shortcut="d" label="Deadline" />
    </div>
  );
}

function handleInitialKey(event: CommandKeyEvent, onSelect: (step: NextActionEditStep) => void, onCancel: () => void) {
  if (event.key === "Escape") return cancelKey(event, onCancel);
  const selectedStep = keyToStep(event.key);
  if (selectedStep) selectKey(event, () => onSelect(selectedStep));
}

function EditCommand({ shortcut, label }: Readonly<{ shortcut: string; label: string }>) {
  return <button className="processing-dialog__command" type="button"><kbd>{shortcut}</kbd><span>{label}</span></button>;
}

function renderContextStep(contextIds: string[], setContextIds: (contextIds: string[]) => void, savePatch: (patch: NextActionPatch) => void, onBack: () => void) {
  return <ProcessingContextStep initialSelectedIds={contextIds} onSelectedIdsChange={setContextIds} onContextsSelected={(nextIds) => savePatch({ contextIds: nextIds })} onBack={onBack} />;
}

function renderEnergyStep(digits: string, setDigits: (digits: string) => void, savePatch: (patch: NextActionPatch) => void, onBack: () => void) {
  return <ProcessingEnergyStep digits={digits} onDigitsChange={setDigits} onEnergySelected={(energy) => savePatch({ energy })} onBack={onBack} />;
}

function renderTimeStep(digits: string, setDigits: (digits: string) => void, savePatch: (patch: NextActionPatch) => void, onBack: () => void) {
  return <ProcessingTimeStep digits={digits} onDigitsChange={setDigits} onTimeSelected={(minutes) => savePatch(estimatedTimePatch(minutes))} onBack={onBack} />;
}

function renderDeadlineStep(value: string, setValue: (value: string) => void, savePatch: (patch: NextActionPatch) => void, onBack: () => void) {
  return <NextActionDeadlineStep value={value} onDeadlineChange={setValue} onDeadlineSelected={(deadline) => savePatch(deadlinePatch(deadline))} onBack={onBack} />;
}

function deadlinePatch(deadline: string | null): NextActionPatch {
  return deadline ? { deadline } : { clearDeadline: true };
}

function keyToStep(key: string): NextActionEditStep | null {
  if (key.toLowerCase() === "e") return "energy";
  if (key.toLowerCase() === "c") return "context";
  if (key.toLowerCase() === "t") return "time";
  if (key.toLowerCase() === "d") return "deadline";
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
  const [contextIds, setContextIds] = useState(() => initialContextIds(item));
  const [deadline, setDeadline] = useState(() => item.deadline ?? "");
  const [energyDigits, setEnergyDigits] = useState(() => initialEnergyDigits(item));
  const [timeDigits, setTimeDigits] = useState(() => initialTimeDigits(item));
  const backToInitial = () => setStep("initial");
  const savePatch = (patch: NextActionPatch) => void onSave(patch);

  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Edit next action">
      <div className="processing-dialog__title">Edit Next Action</div>
      <div className="processing-dialog__content">
        {step === "initial" ? <NextActionEditInitialStep onSelect={setStep} onCancel={onClose} /> : null}
        {step === "context" ? renderContextStep(contextIds, setContextIds, savePatch, backToInitial) : null}
        {step === "deadline" ? renderDeadlineStep(deadline, setDeadline, savePatch, backToInitial) : null}
        {step === "energy" ? renderEnergyStep(energyDigits, setEnergyDigits, savePatch, backToInitial) : null}
        {step === "time" ? renderTimeStep(timeDigits, setTimeDigits, savePatch, backToInitial) : null}
      </div>
    </section>
  );
}
