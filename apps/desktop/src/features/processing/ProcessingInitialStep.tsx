import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

type ProcessingInitialStepProps = Readonly<{
  onNextAction: () => void;
  onCalendar: () => void;
  onProject: () => void;
  onCancel: () => void;
  allowProject?: boolean;
}>;

export function ProcessingInitialStep({ allowProject = true, onNextAction, onCalendar, onProject, onCancel }: ProcessingInitialStepProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }

    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      event.stopPropagation();
      onNextAction();
      return;
    }

    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      event.stopPropagation();
      onCalendar();
      return;
    }

    if (allowProject && event.key.toLowerCase() === "p") {
      event.preventDefault();
      event.stopPropagation();
      onProject();
    }
  };

  return (
    <div ref={containerRef} className="processing-dialog__step processing-dialog__step--initial" tabIndex={-1} onKeyDown={handleKeyDown}>
      <button className="processing-dialog__command" type="button" onClick={onNextAction}>
        <kbd>n</kbd><span>Next actions</span>
      </button>
      <button className="processing-dialog__command" type="button" onClick={onCalendar}>
        <kbd>c</kbd><span>Calendar</span>
      </button>
      {allowProject ? <button className="processing-dialog__command" type="button" onClick={onProject}><kbd>p</kbd><span>Projects</span></button> : null}
    </div>
  );
}
