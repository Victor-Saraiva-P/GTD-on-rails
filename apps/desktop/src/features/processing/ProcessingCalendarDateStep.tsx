import { useEffect, useRef, useState } from "react";
import type { Dispatch, KeyboardEvent, ReactElement, RefObject, SetStateAction } from "react";
import {
  initialSegmentedCalendarDateState,
  moveSegmentedCalendarDateFocus,
  nextSegmentedCalendarDateDigit,
  segmentedCalendarDateIsoValue,
  segmentedCalendarDateStateFromIsoValue
} from "./processingFlow";
import type { SegmentedCalendarDateState } from "./processingFlow";

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
  const { dateState, error, inputRef, handleKeyDown } = useSegmentedCalendarDateControl({ date, onDateChange, onDateSelected, onBack });
  return (
    <div className="processing-dialog__step processing-dialog__step--calendar-date">
      <div className="processing-dialog__label" id="processing-calendar-date-label">Scheduled date:</div>
      <DateControl dateState={dateState} error={error} inputRef={inputRef} onKeyDown={handleKeyDown} />
      {error && <div className="processing-dialog__error" role="alert">{error}</div>}
    </div>
  );
}

function useSegmentedCalendarDateControl({ date, onDateChange, onDateSelected, onBack }: ProcessingCalendarDateStepProps): DateControlModel {
  const inputRef = useRef<HTMLDivElement>(null);
  const [dateState, setDateState] = useState<SegmentedCalendarDateState>(() => initialDateState(date));
  const [error, setError] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const applyDigit = (digit: string) => applyCalendarDateDigit(dateState, digit, setError, setDateState, onDateChange);
  const confirmDate = () => confirmCalendarDate(dateState, setError, onDateChange, onDateSelected);
  const moveFocus = (direction: "h" | "l") => moveCalendarDateFocus(dateState, direction, setError, setDateState);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => handleCalendarDateKeyDown(event, { applyDigit, confirmDate, moveFocus, onBack });
  return { dateState, error, inputRef, handleKeyDown };
}

function handleCalendarDateKeyDown(event: KeyboardEvent<HTMLDivElement>, actions: CalendarDateControlActions): void {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") return actions.onBack();
  if (event.key === "Enter") return actions.confirmDate();
  if (event.key === "Backspace") return;
  if (event.key === "h" || event.key === "l") return actions.moveFocus(event.key);
  if (/^\d$/.test(event.key)) actions.applyDigit(event.key);
}

function applyCalendarDateDigit(state: SegmentedCalendarDateState, digit: string, setError: SetStringState, setState: SetDateState, onDateChange: (date: string) => void): void {
  const nextState = nextSegmentedCalendarDateDigit(state, digit);
  const isoDate = segmentedCalendarDateIsoValue(nextState);
  setError("");
  setState(nextState);
  if (isoDate) onDateChange(isoDate);
}

function confirmCalendarDate(state: SegmentedCalendarDateState, setError: SetStringState, onDateChange: (date: string) => void, onDateSelected: (date: string) => void): void {
  const isoDate = segmentedCalendarDateIsoValue(state);
  if (!isoDate) return setError("Enter a valid calendar date.");
  onDateChange(isoDate);
  onDateSelected(isoDate);
}

function moveCalendarDateFocus(state: SegmentedCalendarDateState, direction: "h" | "l", setError: SetStringState, setState: SetDateState): void {
  setError("");
  setState(moveSegmentedCalendarDateFocus(state, direction));
}

function DateControl({ dateState, error, inputRef, onKeyDown }: DateControlProps): ReactElement {
  return (
    <div ref={inputRef} aria-invalid={error ? "true" : "false"} aria-labelledby="processing-calendar-date-label" className="processing-dialog__input processing-dialog__date-control" onKeyDown={onKeyDown} role="textbox" tabIndex={0}>
      <DateSegmentText active={dateState.activeSegment === "day"} value={dateState.day} width={2} />
      <span className="processing-dialog__date-separator">/</span>
      <DateSegmentText active={dateState.activeSegment === "month"} value={dateState.month} width={2} />
      <span className="processing-dialog__date-separator">/</span>
      <DateSegmentText active={dateState.activeSegment === "year"} value={dateState.year} width={4} />
    </div>
  );
}

function initialDateState(date: string): SegmentedCalendarDateState {
  return segmentedCalendarDateStateFromIsoValue(date) ?? initialSegmentedCalendarDateState();
}

function DateSegmentText({ active, value, width }: DateSegmentTextProps): ReactElement {
  const className = active ? "processing-dialog__date-segment processing-dialog__date-segment--active" : "processing-dialog__date-segment";
  return <span className={className}>{value.padEnd(width, "_")}</span>;
}

type DateControlProps = {
  dateState: SegmentedCalendarDateState;
  error: string;
  inputRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

type DateSegmentTextProps = {
  active: boolean;
  value: string;
  width: number;
};

type DateControlModel = {
  dateState: SegmentedCalendarDateState;
  error: string;
  inputRef: RefObject<HTMLDivElement | null>;
  handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

type CalendarDateControlActions = {
  applyDigit: (digit: string) => void;
  confirmDate: () => void;
  moveFocus: (direction: "h" | "l") => void;
  onBack: () => void;
};

type SetDateState = Dispatch<SetStateAction<SegmentedCalendarDateState>>;
type SetStringState = Dispatch<SetStateAction<string>>;
