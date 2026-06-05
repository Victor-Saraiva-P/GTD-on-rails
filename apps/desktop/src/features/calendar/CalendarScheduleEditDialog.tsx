import { useState } from "react";
import { ProcessingCalendarDateStep } from "../processing/ProcessingCalendarDateStep";
import { ProcessingCalendarTimeStep } from "../processing/ProcessingCalendarTimeStep";
import {
  initialCalendarScheduleDraft,
  saveCalendarScheduleDraft
} from "./calendarDateUtils";
import type { Calendar, CalendarPatch } from "./types";

type CalendarScheduleEditDialogProps = Readonly<{
  item: Calendar;
  onClose: () => void;
  onSave: (patch: CalendarPatch) => Promise<void> | void;
}>;

type CalendarScheduleEditStep = "date" | "time";

/**
 * Edits a calendar's stated scheduled date and optional time.
 *
 * @example <CalendarScheduleEditDialog item={calendar} onClose={close} onSave={save} />
 */
export function CalendarScheduleEditDialog(props: CalendarScheduleEditDialogProps) {
  const initialDraft = initialCalendarScheduleDraft(props.item);
  const [step, setStep] = useState<CalendarScheduleEditStep>("date");
  const [scheduledDate, setScheduledDate] = useState(initialDraft.scheduledDate);
  const [timeDigits, setTimeDigits] = useState(initialDraft.timeDigits);
  const selectDate = (date: string) => {
    setScheduledDate(date);
    setStep("time");
  };
  const saveSchedule = () => saveCalendarSchedule(props.onSave, props.onClose, scheduledDate, timeDigits);

  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Edit calendar schedule">
      <div className="processing-dialog__title">Edit calendar schedule</div>
      <div className="processing-dialog__content">
        {step === "date" ? <ProcessingCalendarDateStep date={scheduledDate} onDateChange={setScheduledDate} onDateSelected={selectDate} onBack={props.onClose} /> : null}
        {step === "time" ? <ProcessingCalendarTimeStep digits={timeDigits} onDigitsChange={setTimeDigits} onTimeSelected={saveSchedule} onBack={() => setStep("date")} /> : null}
      </div>
    </section>
  );
}

function saveCalendarSchedule(
  onSave: CalendarScheduleEditDialogProps["onSave"],
  onClose: () => void,
  scheduledDate: string,
  timeDigits: string
): void {
  const patch = saveCalendarScheduleDraft(scheduledDate, timeDigits);
  void Promise.resolve(onSave(patch)).then(onClose);
}
