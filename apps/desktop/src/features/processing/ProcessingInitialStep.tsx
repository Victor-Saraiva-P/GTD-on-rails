import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

type ProcessingInitialStepProps = Readonly<{
  onNextAction: () => void;
  onCalendar: () => void;
  onRecurringCalendar: () => void;
  onCancel: () => void;
}>;

export function ProcessingInitialStep({ onNextAction, onCalendar, onRecurringCalendar, onCancel }: ProcessingInitialStepProps) {
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

    if (event.key === "C") {
      event.preventDefault();
      event.stopPropagation();
      onRecurringCalendar();
      return;
    }

    if (event.key === "c") {
      event.preventDefault();
      event.stopPropagation();
      onCalendar();
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
      <button className="processing-dialog__command" type="button" onClick={onRecurringCalendar}>
        <kbd>C</kbd><span>Recurring</span>
      </button>
    </div>
  );
}
