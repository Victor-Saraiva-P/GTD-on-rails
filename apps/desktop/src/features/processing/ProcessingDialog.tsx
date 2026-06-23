import { useState } from "react";
import type { Stuff } from "../inbox/types";
import { ProcessingInitialStep } from "./ProcessingInitialStep";
import { ProcessingCalendarDateStep } from "./ProcessingCalendarDateStep";
import { ProcessingCalendarTimeStep } from "./ProcessingCalendarTimeStep";
import { ProcessingContextStep } from "./ProcessingContextStep";
import { ProcessingEnergyStep } from "./ProcessingEnergyStep";
import { ProcessingTimeStep } from "./ProcessingTimeStep";
import { ProcessingRecurringIntervalStep } from "./ProcessingRecurringIntervalStep";
import { ProcessingRecurringEndDateStep, ProcessingRecurringStartDateStep } from "./ProcessingRecurringDateSteps";
import { NextActionDeadlineStep } from "../next-actions/NextActionDeadlineStep";
import { buildCalendarPayload, buildRecurringCalendarTemplatePayload, previousProcessingStep, stepAfterInitialChoice } from "./processingFlow";
import type { CalendarConversionPayload } from "../calendar/types";
import type { RecurrenceUnit, RecurringCalendarTemplateConversionPayload } from "../recurring-calendar-templates/types";
import type { ProcessingStep } from "./processingFlow";

type ProcessingDialogProps = Readonly<{
  item: Stuff;
  onClose: () => void;
  onProcess: (energy: number | null, estimatedTimeMinutes: number | null, contextIds: string[], deadline: string | null) => void;
  onProcessCalendar: (payload: CalendarConversionPayload) => void;
  onProcessRecurringCalendar: (payload: RecurringCalendarTemplateConversionPayload) => void;
}>;

/**
 * Shows the processing command wizard for the selected stuff.
 *
 * @example <ProcessingDialog item={stuff} onClose={close} onProcess={process} onProcessCalendar={processCalendar} onProcessRecurringCalendar={processRecurring} />
 */
export function ProcessingDialog({ item, onClose, onProcess, onProcessCalendar, onProcessRecurringCalendar }: ProcessingDialogProps) {
  const [step, setStep] = useState<ProcessingStep>("initial");
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [selectedDeadline, setSelectedDeadline] = useState("");
  const [selectedEnergyDigits, setSelectedEnergyDigits] = useState("");
  const [selectedTimeDigits, setSelectedTimeDigits] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [selectedCalendarTimeDigits, setSelectedCalendarTimeDigits] = useState("");
  const [selectedRecurringStartDate, setSelectedRecurringStartDate] = useState("");
  const [selectedRecurringIntervalDigits, setSelectedRecurringIntervalDigits] = useState("");
  const [selectedRecurringIntervalValue, setSelectedRecurringIntervalValue] = useState(1);
  const [selectedRecurringUnit, setSelectedRecurringUnit] = useState<RecurrenceUnit>("day");
  const [selectedRecurringTimeDigits, setSelectedRecurringTimeDigits] = useState("");
  const [selectedRecurringEndDate, setSelectedRecurringEndDate] = useState("");

  const handleNextAction = () => {
    setStep(stepAfterInitialChoice("next-action"));
  };

  const handleCalendar = () => {
    setStep(stepAfterInitialChoice("calendar"));
  };

  const handleRecurringCalendar = () => {
    setStep(stepAfterInitialChoice("recurring-calendar"));
  };

  const handleContextsSelected = (contextIds: string[]) => {
    setSelectedContextIds(contextIds);
    setStep("set-energy");
  };

  const handleDeadlineSelected = (deadline: string | null) => {
    setSelectedDeadline(deadline ?? "");
    setStep("select-context");
  };

  const handleEnergySelected = (energy: number | null) => {
    setStep("set-time");
  };

  const handleTimeSelected = (minutes: number | null) => {
    const energy = selectedEnergyDigits ? parseInt(selectedEnergyDigits, 10) / 10 : null;
    onProcess(energy, minutes, selectedContextIds, selectedDeadline || null);
  };

  const handleCalendarDateSelected = (scheduledDate: string) => {
    setSelectedCalendarDate(scheduledDate);
    setStep("set-calendar-time");
  };

  const handleCalendarTimeSelected = () => {
    onProcessCalendar(buildCalendarPayload(selectedCalendarDate, selectedCalendarTimeDigits));
  };

  const handleRecurringStartDateSelected = (startDate: string) => {
    setSelectedRecurringStartDate(startDate);
    setStep("set-recurring-interval");
  };

  const handleRecurringIntervalSelected = (value: number, unit: RecurrenceUnit) => {
    setSelectedRecurringIntervalValue(value);
    setSelectedRecurringUnit(unit);
    setStep("set-recurring-time");
  };

  const handleRecurringTimeSelected = () => setStep("set-recurring-end-date");

  const handleRecurringEndDateSelected = (endDate: string | null) => {
    const weekdays = selectedRecurringUnit === "week" ? [weekdayName(selectedRecurringStartDate)] : [];
    onProcessRecurringCalendar(buildRecurringCalendarTemplatePayload(
      selectedRecurringStartDate, selectedRecurringTimeDigits,
      selectedRecurringIntervalValue, selectedRecurringUnit, weekdays, endDate));
  };

  const handleBack = () => setStep((currentStep) => previousProcessingStep(currentStep));

  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Processing">
      <div className="processing-dialog__title">Processing</div>
      <div className="processing-dialog__content">
        {step === "initial" && (
          <ProcessingInitialStep onNextAction={handleNextAction} onCalendar={handleCalendar} onRecurringCalendar={handleRecurringCalendar} onCancel={onClose} />
        )}
        {step === "set-calendar-date" && (
          <ProcessingCalendarDateStep date={selectedCalendarDate} onDateChange={setSelectedCalendarDate} onDateSelected={handleCalendarDateSelected} onBack={handleBack} />
        )}
        {step === "set-calendar-time" && (
          <ProcessingCalendarTimeStep digits={selectedCalendarTimeDigits} onDigitsChange={setSelectedCalendarTimeDigits} onTimeSelected={handleCalendarTimeSelected} onBack={handleBack} />
        )}
        {step === "set-deadline" && (
          <NextActionDeadlineStep value={selectedDeadline} enableTodayShortcut onDeadlineChange={setSelectedDeadline} onDeadlineSelected={handleDeadlineSelected} onBack={handleBack} />
        )}
        {step === "select-context" && (
          <ProcessingContextStep onContextsSelected={handleContextsSelected} onSelectedIdsChange={setSelectedContextIds} onBack={handleBack} initialSelectedIds={selectedContextIds} />
        )}
        {step === "set-energy" && (
          <ProcessingEnergyStep digits={selectedEnergyDigits} onDigitsChange={setSelectedEnergyDigits} onEnergySelected={handleEnergySelected} onBack={handleBack} />
        )}
        {step === "set-time" && (
          <ProcessingTimeStep digits={selectedTimeDigits} onDigitsChange={setSelectedTimeDigits} onTimeSelected={handleTimeSelected} onBack={handleBack} />
        )}
        {step === "set-recurring-start-date" && (
          <ProcessingRecurringStartDateStep date={selectedRecurringStartDate} onDateChange={setSelectedRecurringStartDate} onDateSelected={handleRecurringStartDateSelected} onBack={handleBack} />
        )}
        {step === "set-recurring-interval" && (
          <ProcessingRecurringIntervalStep digits={selectedRecurringIntervalDigits} onDigitsChange={setSelectedRecurringIntervalDigits} onIntervalSelected={handleRecurringIntervalSelected} onBack={handleBack} />
        )}
        {step === "set-recurring-time" && (
          <ProcessingCalendarTimeStep digits={selectedRecurringTimeDigits} onDigitsChange={setSelectedRecurringTimeDigits} onTimeSelected={handleRecurringTimeSelected} onBack={handleBack} />
        )}
        {step === "set-recurring-end-date" && (
          <ProcessingRecurringEndDateStep date={selectedRecurringEndDate} onDateChange={setSelectedRecurringEndDate} onDateSelected={handleRecurringEndDateSelected} onBack={handleBack} />
        )}
      </div>
    </section>
  );
}

function weekdayName(isoDate: string): string {
  const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return weekdays[new Date(`${isoDate}T00:00:00`).getDay()];
}
