import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { clockTimeDisplayValue, nextClockTimeDigits } from "./processingFlow";

type ProcessingCalendarTimeStepProps = Readonly<{
  digits: string;
  onDigitsChange: (digits: string) => void;
  onTimeSelected: () => void;
  onBack: () => void;
}>;

/**
 * Captures optional HH:mm time for calendar processing.
 *
 * @example <ProcessingCalendarTimeStep digits="0930" onTimeSelected={commit} onBack={back} onDigitsChange={setDigits} />
 */
export function ProcessingCalendarTimeStep({ digits, onDigitsChange, onTimeSelected, onBack }: ProcessingCalendarTimeStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = clockTimeDisplayValue(digits);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") onBack();
    if (event.key === "Enter") onTimeSelected();
    if (event.key === "Backspace") onDigitsChange(digits.slice(0, -1));
    if (/^\d$/.test(event.key)) onDigitsChange(nextClockTimeDigits(digits, event.key));
  };

  return (
    <div className="processing-dialog__step processing-dialog__step--calendar-time">
      <div className="processing-dialog__label">Scheduled time (optional):</div>
      <input
        ref={inputRef}
        type="text"
        className="processing-dialog__input processing-dialog__input--time"
        placeholder="No time"
        value={displayValue}
        onKeyDown={handleKeyDown}
        readOnly
      />
    </div>
  );
}
