import type { CalendarConversionPayload } from "../calendar/types";
import type { RecurrenceUnit, RecurringCalendarTemplateConversionPayload } from "../recurring-calendar-templates/types";

export type ProcessingStep =
  | "initial"
  | "set-deadline"
  | "select-context"
  | "set-energy"
  | "set-time"
  | "set-calendar-date"
  | "set-calendar-time"
  | "set-recurring-start-date"
  | "set-recurring-interval"
  | "set-recurring-time"
  | "set-recurring-end-date";

export type ProcessingInitialChoice = "next-action" | "calendar" | "recurring-calendar";
export type SegmentedCalendarDateSegment = "day" | "month" | "year";

export type SegmentedCalendarDateState = {
  day: string;
  month: string;
  year: string;
  activeSegment: SegmentedCalendarDateSegment;
  activeDigitCount: number;
};

export function stepAfterInitialChoice(choice: ProcessingInitialChoice): ProcessingStep {
  if (choice === "recurring-calendar") return "set-recurring-start-date";
  return choice === "calendar" ? "set-calendar-date" : "set-deadline";
}

export function previousProcessingStep(step: ProcessingStep): ProcessingStep {
  if (step === "set-time") return "set-energy";
  if (step === "set-energy") return "select-context";
  if (step === "select-context") return "set-deadline";
  if (step === "set-calendar-time") return "set-calendar-date";
  if (step === "set-recurring-end-date") return "set-recurring-time";
  if (step === "set-recurring-time") return "set-recurring-interval";
  if (step === "set-recurring-interval") return "set-recurring-start-date";
  return "initial";
}

export function nextClockTimeDigits(currentDigits: string, digit: string): string {
  const nextDigits = `${currentDigits}${digit}`;
  if (!/^\d{1,4}$/.test(nextDigits)) return currentDigits;
  return isValidClockTimeDigits(nextDigits) ? nextDigits : currentDigits;
}

export function clockTimeDisplayValue(digits: string): string {
  if (!digits) return "";
  const paddedDigits = digits.padStart(4, "0");
  return `${paddedDigits.slice(0, 2)}:${paddedDigits.slice(2)}`;
}

export function initialSegmentedCalendarDateState(currentDate: Date = new Date()): SegmentedCalendarDateState {
  return {
    day: paddedDatePart(currentDate.getDate(), 2),
    month: paddedDatePart(currentDate.getMonth() + 1, 2),
    year: paddedDatePart(currentDate.getFullYear(), 4),
    activeSegment: "day",
    activeDigitCount: 0
  };
}

export function blankSegmentedCalendarDateState(): SegmentedCalendarDateState {
  return {
    day: "",
    month: "",
    year: "",
    activeSegment: "day",
    activeDigitCount: 0
  };
}

export function nextSegmentedCalendarDateDigit(state: SegmentedCalendarDateState, digit: string): SegmentedCalendarDateState {
  if (!/^\d$/.test(digit)) return state;
  const maxLength = segmentLength(state.activeSegment);
  const nextValue = nextSegmentValue(state, digit, maxLength);
  const nextCount = Math.min(state.activeDigitCount + 1, maxLength);
  return withSegmentValue(state, nextValue, nextCount);
}

export function moveSegmentedCalendarDateFocus(state: SegmentedCalendarDateState, direction: "h" | "l"): SegmentedCalendarDateState {
  const activeSegment = direction === "h" ? previousDateSegment(state.activeSegment) : nextDateSegment(state.activeSegment);
  return { ...state, activeSegment, activeDigitCount: 0 };
}

export function segmentedCalendarDateDisplayValue(state: SegmentedCalendarDateState): string {
  return `${displayDateSegment(state.day, 2)}/${displayDateSegment(state.month, 2)}/${displayDateSegment(state.year, 4)}`;
}

export function isSegmentedCalendarDateValid(state: SegmentedCalendarDateState): boolean {
  return segmentedCalendarDateIsoValue(state) !== null;
}

export function segmentedCalendarDateIsoValue(state: SegmentedCalendarDateState): string | null {
  if (!hasCompleteCalendarDateSegments(state)) return null;
  const day = parseInt(state.day, 10);
  const month = parseInt(state.month, 10);
  const year = parseInt(state.year, 10);
  if (!isRealCalendarDate(year, month, day)) return null;
  return `${state.year}-${state.month}-${state.day}`;
}

export function segmentedCalendarDateStateFromIsoValue(value: string): SegmentedCalendarDateState | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-");
  const state = dateStateFromSegments(day, month, year);
  return isSegmentedCalendarDateValid(state) ? state : null;
}

export function buildCalendarPayload(scheduledDate: string, timeDigits: string): CalendarConversionPayload {
  return {
    scheduledDate,
    scheduledTime: clockTimeDisplayValue(timeDigits) || null
  };
}

export function buildRecurringCalendarTemplatePayload(
  startDate: string,
  timeDigits: string,
  intervalValue: number,
  recurrenceUnit: RecurrenceUnit,
  weeklyWeekdays: string[],
  endDate: string | null
): RecurringCalendarTemplateConversionPayload {
  return { startDate, scheduledTime: clockTimeDisplayValue(timeDigits) || null, intervalValue, recurrenceUnit, weeklyWeekdays, endDate };
}

function isValidClockTimeDigits(digits: string): boolean {
  if (digits.length <= 1) return true;
  if (parseInt(digits.slice(0, 2), 10) >= 24) return false;
  if (digits.length <= 2) return true;
  return parseInt(digits.slice(2, 3), 10) < 6;
}

function paddedDatePart(value: number, length: number): string {
  return value.toString().padStart(length, "0");
}

function segmentLength(segment: SegmentedCalendarDateSegment): number {
  return segment === "year" ? 4 : 2;
}

function nextSegmentValue(state: SegmentedCalendarDateState, digit: string, maxLength: number): string {
  const currentValue = state[state.activeSegment];
  if (state.activeDigitCount === 0) return digit;
  return `${currentValue}${digit}`.slice(0, maxLength);
}

function withSegmentValue(state: SegmentedCalendarDateState, value: string, digitCount: number): SegmentedCalendarDateState {
  const maxLength = segmentLength(state.activeSegment);
  const activeSegment = digitCount >= maxLength ? nextInputDateSegment(state.activeSegment) : state.activeSegment;
  return { ...state, [state.activeSegment]: value, activeSegment, activeDigitCount: digitCount >= maxLength ? 0 : digitCount };
}

function previousDateSegment(segment: SegmentedCalendarDateSegment): SegmentedCalendarDateSegment {
  if (segment === "year") return "month";
  if (segment === "month") return "day";
  return "day";
}

function nextDateSegment(segment: SegmentedCalendarDateSegment): SegmentedCalendarDateSegment {
  if (segment === "day") return "month";
  if (segment === "month") return "year";
  return "year";
}

function nextInputDateSegment(segment: SegmentedCalendarDateSegment): SegmentedCalendarDateSegment {
  if (segment === "day") return "month";
  if (segment === "month") return "year";
  return "day";
}

function displayDateSegment(value: string, length: number): string {
  return value.padEnd(length, "_");
}

function hasCompleteCalendarDateSegments(state: SegmentedCalendarDateState): boolean {
  return state.day.length === 2 && state.month.length === 2 && state.year.length === 4;
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function dateStateFromSegments(day: string, month: string, year: string): SegmentedCalendarDateState {
  return { day, month, year, activeSegment: "day", activeDigitCount: 0 };
}
