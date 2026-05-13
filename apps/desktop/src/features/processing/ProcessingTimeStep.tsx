import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

type ProcessingTimeStepProps = {
  digits: string;
  onDigitsChange: (digits: string) => void;
  onTimeSelected: (minutes: number | null) => void;
  onBack: () => void;
};

export function ProcessingTimeStep({ digits, onDigitsChange, onTimeSelected, onBack }: ProcessingTimeStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-format digits to a time string like "0min", "1min", "1h 30min", "12h 45min"
  let displayValue = "";
  if (digits) {
    const padded = digits.padStart(4, "0");
    const hours = parseInt(padded.slice(0, 2), 10);
    const mins = padded.slice(-2);
    
    if (hours > 0) {
      displayValue = `${hours}h ${mins}min`;
    } else {
      displayValue = `${parseInt(mins, 10)}min`;
    }
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const setNextDigits = (nextDigits: string) => {
    onDigitsChange(nextDigits);
  };

  const handleDigit = (digit: string) => {
    const numStr = parseInt(digits + digit, 10).toString();
    const minutes = parseInt(numStr.padStart(4, "0").slice(-2), 10);
    if (numStr.length <= 4 && minutes < 60) setNextDigits(numStr);
  };

  const commitTime = () => {
    if (!digits) return onTimeSelected(null);
    const padded = digits.padStart(4, "0");
    const hours = parseInt(padded.slice(0, 2), 10);
    const mins = parseInt(padded.slice(-2), 10);
    return onTimeSelected(hours * 60 + mins);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") onBack();
    if (event.key === "Enter") commitTime();
    if (event.key === "Backspace") setNextDigits(digits.slice(0, -1));
    if (/^\d$/.test(event.key)) handleDigit(event.key);
  };

  return (
    <div className="processing-dialog__step processing-dialog__step--time">
      <div className="processing-dialog__label">Estimated time (h min):</div>
      <input 
        ref={inputRef}
        type="text" 
        className="processing-dialog__input processing-dialog__input--time"
        placeholder="0min"
        value={displayValue}
        onKeyDown={handleKeyDown}
        readOnly
      />
    </div>
  );
}
