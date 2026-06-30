import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { NextActionDeadlineStep } from "../next-actions/NextActionDeadlineStep";
import type { Project, ProjectPatch } from "./types";

type ProjectEditDialogProps = Readonly<{
  item: Project;
  onClose: () => void;
  onSave: (patch: ProjectPatch) => Promise<void>;
}>;

type ProjectEditStep = "initial" | "title" | "deadline";

function ProjectEditInitialStep({ onSelect, onClose }: Readonly<{ onSelect: (step: ProjectEditStep) => void; onClose: () => void }>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["Escape", "t", "T", "d", "D"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") onClose();
    if (event.key.toLowerCase() === "t") onSelect("title");
    if (event.key.toLowerCase() === "d") onSelect("deadline");
  };
  return (
    <div ref={ref} className="processing-dialog__step processing-dialog__step--initial" tabIndex={-1} onKeyDown={handleKeyDown}>
      <button className="processing-dialog__command" type="button" onClick={() => onSelect("title")}><kbd>t</kbd><span>Title</span></button>
      <button className="processing-dialog__command" type="button" onClick={() => onSelect("deadline")}><kbd>d</kbd><span>Deadline</span></button>
    </div>
  );
}

function ProjectTitleStep({ value, onValueChange, onBack, onSave }: Readonly<{ value: string; onValueChange: (value: string) => void; onBack: () => void; onSave: () => void }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape" && event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") onBack();
    if (event.key === "Enter") onSave();
  };
  return <input ref={inputRef} className="processing-dialog__input" aria-label="Title:" value={value} onChange={(event) => onValueChange(event.target.value)} onKeyDown={handleKeyDown} />;
}

function deadlinePatch(deadline: string | null): ProjectPatch {
  return deadline ? { deadline } : { clearDeadline: true };
}

/**
 * Edits project title and deadline from an isolated modal keybinding scope.
 *
 * @example <ProjectEditDialog item={project} onSave={save} onClose={close} />
 */
export function ProjectEditDialog({ item, onClose, onSave }: ProjectEditDialogProps) {
  const [step, setStep] = useState<ProjectEditStep>("initial");
  const [title, setTitle] = useState(item.title);
  const [deadline, setDeadline] = useState(item.deadline ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateTitle = (value: string) => { setTitle(value); setError(null); };
  const saveTitle = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    await onSave({ title: title.trim() });
  };
  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Edit project">
      <div className="processing-dialog__title">Edit project</div>
      {error ? <p className="processing-dialog__error" role="alert">{error}</p> : null}
      {step === "initial" ? <ProjectEditInitialStep onSelect={setStep} onClose={onClose} /> : null}
      {step === "title" ? <ProjectTitleStep value={title} onValueChange={updateTitle} onBack={() => setStep("initial")} onSave={saveTitle} /> : null}
      {step === "deadline" ? <NextActionDeadlineStep value={deadline} enableTodayShortcut onDeadlineChange={setDeadline} onDeadlineSelected={(value) => onSave(deadlinePatch(value))} onBack={() => setStep("initial")} /> : null}
    </section>
  );
}
