import { SegmentedDateStep } from "./SegmentedDateStep";

type RequiredRecurringDateStepProps = Readonly<{
  date: string;
  onBack: () => void;
  onDateChange: (date: string) => void;
  onDateSelected: (date: string) => void;
}>;

type OptionalRecurringDateStepProps = Readonly<{
  date: string;
  onBack: () => void;
  onDateChange: (date: string) => void;
  onDateSelected: (date: string | null) => void;
}>;

/**
 * Captures the first date for a Recurring Calendar Template.
 *
 * @example <ProcessingRecurringStartDateStep date="2026-05-21" ... />
 */
export function ProcessingRecurringStartDateStep(props: RequiredRecurringDateStepProps) {
  return <SegmentedDateStep date={props.date} enableTodayShortcut invalidMessage="Enter a valid start date." label="Start date:" mode="required" onBack={props.onBack} onDateChange={props.onDateChange} onDateSelected={(date) => date && props.onDateSelected(date)} />;
}

/**
 * Captures the optional final date for a Recurring Calendar Template.
 *
 * @example <ProcessingRecurringEndDateStep date="" ... />
 */
export function ProcessingRecurringEndDateStep(props: OptionalRecurringDateStepProps) {
  return <SegmentedDateStep date={props.date} invalidMessage="Enter a valid end date." label="End date (optional):" mode="optional" onBack={props.onBack} onDateChange={props.onDateChange} onDateSelected={props.onDateSelected} />;
}
