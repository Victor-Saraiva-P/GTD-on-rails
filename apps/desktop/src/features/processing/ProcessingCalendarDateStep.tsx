import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

type ProcessingCalendarDateStepProps = {
  date: string;
  onDateChange: (date: string) => void;
  onDateSelected: (date: string) => void;
  onBack: () => void;
};

/**
 * Captures the scheduled date for calendar processing.
 *
 * @example <ProcessingCalendarDateStep date="2026-05-21" onDateSelected={save} onBack={back} onDateChange={setDate} />
 */
export function ProcessingCalendarDateStep({ date, onDateChange, onDateSelected, onBack }: ProcessingCalendarDateStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onBack();
    }
    if (event.key === "Enter" && date) {
      event.preventDefault();
      onDateSelected(date);
    }
  };

  return (
    <div className="processing-dialog__step processing-dialog__step--calendar-date">
      <label className="processing-dialog__label" htmlFor="processing-calendar-date">Scheduled date:</label>
      <input
        ref={inputRef}
        id="processing-calendar-date"
        type="date"
        className="processing-dialog__input processing-dialog__input--date"
        value={date}
        onChange={(event) => onDateChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
