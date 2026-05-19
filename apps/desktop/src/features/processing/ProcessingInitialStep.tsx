import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

type ProcessingInitialStepProps = {
  onNextAction: () => void;
  onCancel: () => void;
};

export function ProcessingInitialStep({ onNextAction, onCancel }: ProcessingInitialStepProps) {
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
    }
  };

  return (
    <div ref={containerRef} className="processing-dialog__step processing-dialog__step--initial" tabIndex={-1} onKeyDown={handleKeyDown}>
      <button className="processing-dialog__command" type="button">
        <kbd>n</kbd><span>Next actions</span>
      </button>
    </div>
  );
}
