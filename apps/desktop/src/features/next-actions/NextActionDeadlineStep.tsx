import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

type NextActionDeadlineStepProps = {
  value: string;
  onBack: () => void;
  onDeadlineChange: (value: string) => void;
  onDeadlineSelected: (deadline: string | null) => void;
};

function handleDeadlineKey(event: KeyboardEvent<HTMLInputElement>, props: NextActionDeadlineStepProps) {
  if (event.key === "Escape") {
    event.preventDefault();
    props.onBack();
  }
  if (event.key === "Enter") {
    event.preventDefault();
    props.onDeadlineSelected(props.value || null);
  }
}

/**
 * Captures an optional next-action deadline date.
 *
 * @example <NextActionDeadlineStep value="2026-06-01" ... />
 */
export function NextActionDeadlineStep(props: NextActionDeadlineStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="processing-dialog__step processing-dialog__step--time">
      <label className="processing-dialog__label" htmlFor="next-action-deadline">Deadline</label>
      <input
        ref={inputRef}
        id="next-action-deadline"
        className="processing-dialog__input processing-dialog__input--time"
        type="date"
        value={props.value}
        onChange={(event) => props.onDeadlineChange(event.target.value)}
        onKeyDown={(event) => handleDeadlineKey(event, props)}
      />
      <p className="processing-dialog__hint">Enter Save / Esc Back</p>
    </div>
  );
}
