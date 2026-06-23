import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { RecurrenceUnit } from "../recurring-calendar-templates/types";

type ProcessingRecurringIntervalStepProps = Readonly<{
  digits: string;
  onBack: () => void;
  onDigitsChange: (digits: string) => void;
  onIntervalSelected: (intervalValue: number, recurrenceUnit: RecurrenceUnit) => void;
}>;

/**
 * Captures the recurrence interval value and unit for template processing.
 *
 * @example <ProcessingRecurringIntervalStep digits="2" onIntervalSelected={commit} ... />
 */
export function ProcessingRecurringIntervalStep(props: ProcessingRecurringIntervalStepProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return props.onBack();
    if (event.key === "Backspace") return props.onDigitsChange(props.digits.slice(0, -1));
    if (/^\d$/.test(event.key)) return appendDigit(props, event.key);
    if (event.key === "Enter") return props.onIntervalSelected(intervalValue(props.digits), "day");
    if (event.key === "d") return props.onIntervalSelected(intervalValue(props.digits), "day");
    if (event.key === "w") return props.onIntervalSelected(intervalValue(props.digits), "week");
    if (event.key === "m") return props.onIntervalSelected(intervalValue(props.digits), "month");
    if (event.key === "y") return props.onIntervalSelected(intervalValue(props.digits), "year");
  };

  return (
    <div ref={containerRef} className="processing-dialog__step" tabIndex={-1} onKeyDown={handleKeyDown}>
      <div className="processing-dialog__label">Repeat every:</div>
      <div className="processing-dialog__input">{props.digits || "1"}</div>
      <div className="processing-dialog__hint">Press d, w, m, or y for day, week, month, or year.</div>
    </div>
  );
}

function appendDigit(props: ProcessingRecurringIntervalStepProps, digit: string): void {
  const nextDigits = `${props.digits}${digit}`.replace(/^0+/, "");
  if (/^\d{0,3}$/.test(nextDigits)) props.onDigitsChange(nextDigits);
}

function intervalValue(digits: string): number {
  return Math.max(1, Number.parseInt(digits || "1", 10));
}
