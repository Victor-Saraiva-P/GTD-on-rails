import { SegmentedDateStep } from "../processing/SegmentedDateStep";

type NextActionDeadlineStepProps = Readonly<{
  value: string;
  onBack: () => void;
  onDeadlineChange: (value: string) => void;
  onDeadlineSelected: (deadline: string | null) => void;
}>;

/**
 * Captures an optional next-action deadline date.
 *
 * @example <NextActionDeadlineStep value="2026-06-01" ... />
 */
export function NextActionDeadlineStep(props: NextActionDeadlineStepProps) {
  return <SegmentedDateStep date={props.value} invalidMessage="Enter a valid deadline date." label="Deadline:" mode="optional" onBack={props.onBack} onDateChange={props.onDeadlineChange} onDateSelected={props.onDeadlineSelected} />;
}
