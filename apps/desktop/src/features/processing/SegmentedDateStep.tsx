import { useEffect, useRef, useState } from "react";
import type { Dispatch, KeyboardEvent, ReactElement, RefObject, SetStateAction } from "react";
import {
  blankSegmentedCalendarDateState,
  initialSegmentedCalendarDateState,
  moveSegmentedCalendarDateFocus,
  nextSegmentedCalendarDateDigit,
  segmentedCalendarDateIsoValue,
  segmentedCalendarDateStateFromIsoValue
} from "./processingFlow";
import type { SegmentedCalendarDateState } from "./processingFlow";

export type SegmentedDateStepProps = {
  date: string;
  label: string;
  mode: "required" | "optional";
  invalidMessage: string;
  onBack: () => void;
  onDateChange: (date: string) => void;
  onDateSelected: (date: string | null) => void;
};

/**
 * Captures a local date with segmented dd/mm/yyyy keyboard input.
 *
 * @example <SegmentedDateStep date="2026-05-21" mode="required" label="Scheduled date:" ... />
 */
export function SegmentedDateStep(props: SegmentedDateStepProps) {
  const control = useSegmentedDateControl(props);
  return (
    <div className="processing-dialog__step processing-dialog__step--calendar-date">
      <div className="processing-dialog__label" id="processing-segmented-date-label">{props.label}</div>
      <DateControl dateState={control.dateState} error={control.error} inputRef={control.inputRef} onKeyDown={control.handleKeyDown} />
      {control.error && <div className="processing-dialog__error" role="alert">{control.error}</div>}
    </div>
  );
}

function useSegmentedDateControl(props: SegmentedDateStepProps): DateControlModel {
  const inputRef = useRef<HTMLDivElement>(null);
  const [dateState, setDateState] = useState<SegmentedCalendarDateState>(() => initialDateState(props));
  const [error, setError] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const applyDigit = (digit: string) => applyDateDigit(dateState, digit, setError, setDateState, props.onDateChange);
  const confirmDate = () => confirmDateValue(dateState, setError, props);
  const moveFocus = (direction: "h" | "l") => moveDateFocus(dateState, direction, setError, setDateState);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => handleDateKeyDown(event, { applyDigit, confirmDate, moveFocus, onBack: props.onBack });
  return { dateState, error, inputRef, handleKeyDown };
}

function handleDateKeyDown(event: KeyboardEvent<HTMLDivElement>, actions: DateControlActions): void {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") return actions.onBack();
  if (event.key === "Enter") return actions.confirmDate();
  if (event.key === "Backspace") return;
  if (event.key === "h" || event.key === "l") return actions.moveFocus(event.key);
  if (/^\d$/.test(event.key)) actions.applyDigit(event.key);
}

function applyDateDigit(state: SegmentedCalendarDateState, digit: string, setError: SetStringState, setState: SetDateState, onDateChange: (date: string) => void): void {
  const nextState = nextSegmentedCalendarDateDigit(state, digit);
  const isoDate = segmentedCalendarDateIsoValue(nextState);
  setError("");
  setState(nextState);
  if (isoDate) onDateChange(isoDate);
}

function confirmDateValue(state: SegmentedCalendarDateState, setError: SetStringState, props: SegmentedDateStepProps): void {
  const isoDate = segmentedCalendarDateIsoValue(state);
  if (props.mode === "optional" && isBlankDateState(state)) return props.onDateSelected(null);
  if (!isoDate) return setError(props.invalidMessage);
  props.onDateChange(isoDate);
  props.onDateSelected(isoDate);
}

function moveDateFocus(state: SegmentedCalendarDateState, direction: "h" | "l", setError: SetStringState, setState: SetDateState): void {
  setError("");
  setState(moveSegmentedCalendarDateFocus(state, direction));
}

function DateControl({ dateState, error, inputRef, onKeyDown }: DateControlProps): ReactElement {
  return (
    <div ref={inputRef} aria-invalid={error ? "true" : "false"} aria-labelledby="processing-segmented-date-label" className="processing-dialog__input processing-dialog__date-control" onKeyDown={onKeyDown} role="textbox" tabIndex={0}>
      <DateSegmentText active={dateState.activeSegment === "day"} value={dateState.day} width={2} />
      <span className="processing-dialog__date-separator">/</span>
      <DateSegmentText active={dateState.activeSegment === "month"} value={dateState.month} width={2} />
      <span className="processing-dialog__date-separator">/</span>
      <DateSegmentText active={dateState.activeSegment === "year"} value={dateState.year} width={4} />
    </div>
  );
}

function initialDateState(props: SegmentedDateStepProps): SegmentedCalendarDateState {
  const state = segmentedCalendarDateStateFromIsoValue(props.date);
  if (state) return state;
  return props.mode === "optional" ? blankSegmentedCalendarDateState() : initialSegmentedCalendarDateState();
}

function isBlankDateState(state: SegmentedCalendarDateState): boolean {
  return state.day === "" && state.month === "" && state.year === "";
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

type DateControlActions = {
  applyDigit: (digit: string) => void;
  confirmDate: () => void;
  moveFocus: (direction: "h" | "l") => void;
  onBack: () => void;
};

type SetDateState = Dispatch<SetStateAction<SegmentedCalendarDateState>>;
type SetStringState = Dispatch<SetStateAction<string>>;
