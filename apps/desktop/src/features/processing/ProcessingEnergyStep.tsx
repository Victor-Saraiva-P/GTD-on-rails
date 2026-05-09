import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type ProcessingEnergyStepProps = {
  onEnergySelected: (energy: number | null) => void;
  onCancel: () => void;
};

export function ProcessingEnergyStep({ onEnergySelected, onCancel }: ProcessingEnergyStepProps) {
  const [digits, setDigits] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const digitsRef = useRef("");

  // Auto-format digits to a decimal string like "0.1", "1.8", "10.0"
  const displayValue = digits ? (parseInt(digits, 10) / 10).toFixed(1) : "";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const setNextDigits = (nextDigits: string) => {
    digitsRef.current = nextDigits;
    setDigits(nextDigits);
  };

  const handleDigit = (digit: string) => {
    const nextDigits = digitsRef.current + digit;
    const numValue = parseInt(nextDigits, 10);
    if (numValue <= 100) setNextDigits(numValue.toString());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") onCancel();
    if (event.key === "Enter") onEnergySelected(digitsRef.current ? parseInt(digitsRef.current, 10) / 10 : null);
    if (event.key === "Backspace") setNextDigits(digitsRef.current.slice(0, -1));
    if (/^\d$/.test(event.key)) handleDigit(event.key);
  };

  return (
    <div className="processing-dialog__step processing-dialog__step--energy">
      <div className="processing-dialog__label">Energy level (0.0 - 10.0):</div>
      <input 
        ref={inputRef}
        type="text" 
        className="processing-dialog__input processing-dialog__input--energy"
        placeholder="0.0"
        value={displayValue}
        onKeyDown={handleKeyDown}
        readOnly
      />
    </div>
  );
}
