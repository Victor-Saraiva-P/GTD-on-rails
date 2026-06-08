import { SegmentedDateStep } from "./SegmentedDateStep";

type ProcessingCalendarDateStepProps = Readonly<{
  date: string;
  enableTodayShortcut?: boolean;
  onDateChange: (date: string) => void;
  onDateSelected: (date: string) => void;
  onBack: () => void;
}>;

/**
 * Captures the scheduled date for calendar processing.
 *
 * @example <ProcessingCalendarDateStep date="2026-05-21" onDateSelected={save} onBack={back} onDateChange={setDate} />
 */
export function ProcessingCalendarDateStep({ date, enableTodayShortcut, onDateChange, onDateSelected, onBack }: ProcessingCalendarDateStepProps) {
  const selectDate = (selectedDate: string | null) => {
    if (selectedDate) onDateSelected(selectedDate);
  };
  return <SegmentedDateStep date={date} enableTodayShortcut={enableTodayShortcut} invalidMessage="Enter a valid calendar date." label="Scheduled date:" mode="required" onBack={onBack} onDateChange={onDateChange} onDateSelected={selectDate} />;
}
