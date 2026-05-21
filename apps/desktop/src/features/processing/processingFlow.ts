import type { CalendarConversionPayload } from "../calendar/types";

export type ProcessingStep =
  | "initial"
  | "select-context"
  | "set-energy"
  | "set-time"
  | "set-calendar-date"
  | "set-calendar-time";

export type ProcessingInitialChoice = "next-action" | "calendar";

export function stepAfterInitialChoice(choice: ProcessingInitialChoice): ProcessingStep {
  return choice === "calendar" ? "set-calendar-date" : "select-context";
}

export function previousProcessingStep(step: ProcessingStep): ProcessingStep {
  if (step === "set-time") return "set-energy";
  if (step === "set-energy") return "select-context";
  if (step === "set-calendar-time") return "set-calendar-date";
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

export function buildCalendarPayload(scheduledDate: string, timeDigits: string): CalendarConversionPayload {
  return {
    scheduledDate,
    scheduledTime: clockTimeDisplayValue(timeDigits) || null
  };
}

function isValidClockTimeDigits(digits: string): boolean {
  if (digits.length <= 1) return true;
  if (parseInt(digits.slice(0, 2), 10) >= 24) return false;
  if (digits.length <= 2) return true;
  return parseInt(digits.slice(2, 3), 10) < 6;
}
