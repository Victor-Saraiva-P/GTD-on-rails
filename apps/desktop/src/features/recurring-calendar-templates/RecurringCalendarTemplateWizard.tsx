import { useState } from "react";
import { ProcessingRecurringStartDateStep, ProcessingRecurringEndDateStep } from "../processing/ProcessingRecurringDateSteps";
import { ProcessingRecurringIntervalStep } from "../processing/ProcessingRecurringIntervalStep";
import { ProcessingRecurringWeekdaysStep } from "../processing/ProcessingRecurringWeekdaysStep";
import { ProcessingCalendarTimeStep } from "../processing/ProcessingCalendarTimeStep";
import { buildRecurringCalendarTemplatePayload } from "../processing/processingFlow";
import { weekdayName } from "./recurringCalendarTemplateDisplay";
import type { RecurrenceUnit, RecurringCalendarTemplateConversionPayload } from "./types";

export type RecurringWizardStep = "start-date" | "interval" | "weekdays" | "time" | "end-date";

export type RecurringTemplateDraft = Readonly<{
  startDate?: string;
  scheduledTime?: string | null;
  intervalValue?: number;
  recurrenceUnit?: RecurrenceUnit;
  weeklyWeekdays?: string[];
  endDate?: string | null;
}>;

type RecurringCalendarTemplateWizardProps = Readonly<{
  initialDraft?: RecurringTemplateDraft;
  onCancel: () => void;
  onConfirm: (payload: RecurringCalendarTemplateConversionPayload) => void;
}>;

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Reusable wizard for configuring recurring calendar template schedules.
 *
 * @example <RecurringCalendarTemplateWizard onConfirm={handleSave} onCancel={handleCancel} />
 */
export function RecurringCalendarTemplateWizard({
  initialDraft,
  onCancel,
  onConfirm
}: RecurringCalendarTemplateWizardProps) {
  const [step, setStep] = useState<RecurringWizardStep>("start-date");
  const [startDate, setStartDate] = useState(initialDraft?.startDate || todayIso());
  const [intervalDigits, setIntervalDigits] = useState(initialDraft?.intervalValue?.toString() || "");
  const [intervalValue, setIntervalValue] = useState(initialDraft?.intervalValue || 1);
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>(initialDraft?.recurrenceUnit || "day");
  const [weeklyWeekdays, setWeeklyWeekdays] = useState<string[]>(initialDraft?.weeklyWeekdays || []);
  const [timeDigits, setTimeDigits] = useState(
    initialDraft?.scheduledTime ? initialDraft.scheduledTime.replace(":", "") : ""
  );
  const [endDate, setEndDate] = useState(initialDraft?.endDate || "");

  const handleStartDateSelected = (date: string) => {
    setStartDate(date);
    setStep("interval");
  };

  const handleIntervalSelected = (value: number, unit: RecurrenceUnit) => {
    setIntervalValue(value);
    setRecurrenceUnit(unit);
    if (unit === "week") {
      if (weeklyWeekdays.length === 0) setWeeklyWeekdays([weekdayName(startDate)]);
      setStep("weekdays");
    } else {
      setWeeklyWeekdays([]);
      setStep("time");
    }
  };

  const handleWeekdaysSelected = (weekdays: string[]) => {
    setWeeklyWeekdays(weekdays);
    setStep("time");
  };

  const handleTimeSelected = () => setStep("end-date");

  const handleEndDateSelected = (confirmedEndDate: string | null) => {
    const payload = buildRecurringCalendarTemplatePayload(
      startDate,
      timeDigits,
      intervalValue,
      recurrenceUnit,
      weeklyWeekdays,
      confirmedEndDate
    );
    onConfirm(payload);
  };

  const handleBack = () => {
    if (step === "start-date") return onCancel();
    if (step === "interval") return setStep("start-date");
    if (step === "weekdays") return setStep("interval");
    if (step === "time") return setStep(recurrenceUnit === "week" ? "weekdays" : "interval");
    if (step === "end-date") return setStep("time");
  };

  return (
    <>
      {step === "start-date" && (
        <ProcessingRecurringStartDateStep
          date={startDate}
          onDateChange={setStartDate}
          onDateSelected={handleStartDateSelected}
          onBack={handleBack}
        />
      )}
      {step === "interval" && (
        <ProcessingRecurringIntervalStep
          digits={intervalDigits}
          onDigitsChange={setIntervalDigits}
          onIntervalSelected={handleIntervalSelected}
          onBack={handleBack}
        />
      )}
      {step === "weekdays" && (
        <ProcessingRecurringWeekdaysStep
          defaultWeekday={weekdayName(startDate)}
          initialSelectedWeekdays={weeklyWeekdays}
          onWeekdaysSelected={handleWeekdaysSelected}
          onSelectedWeekdaysChange={setWeeklyWeekdays}
          onBack={handleBack}
        />
      )}
      {step === "time" && (
        <ProcessingCalendarTimeStep
          digits={timeDigits}
          onDigitsChange={setTimeDigits}
          onTimeSelected={handleTimeSelected}
          onBack={handleBack}
        />
      )}
      {step === "end-date" && (
        <ProcessingRecurringEndDateStep
          date={endDate}
          onDateChange={setEndDate}
          onDateSelected={handleEndDateSelected}
          onBack={handleBack}
        />
      )}
    </>
  );
}
