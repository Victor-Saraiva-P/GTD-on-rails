import { useState } from "react";
import { NextActionDeadlineStep } from "../next-actions/NextActionDeadlineStep.tsx";
import type { CalendarWorkspaceItem } from "./types.ts";
import { isNextActionCalendarEntry } from "./types.ts";

type CalendarNextActionDeadlineEditDialogProps = Readonly<{
  item: CalendarWorkspaceItem;
  onClose: () => void;
  onSave: (deadline: string | null) => Promise<void> | void;
}>;

/**
 * Edits the deadline that causes a Next Action to be projected into Calendar.
 *
 * @example <CalendarNextActionDeadlineEditDialog item={entry} onClose={close} onSave={save} />
 */
export function CalendarNextActionDeadlineEditDialog(props: CalendarNextActionDeadlineEditDialogProps) {
  const initialDeadline = isNextActionCalendarEntry(props.item) ? props.item.deadline ?? "" : "";
  const [deadline, setDeadline] = useState(initialDeadline);
  const save = (value: string | null) => void Promise.resolve(props.onSave(value)).then(props.onClose);
  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Edit next action deadline">
      <div className="processing-dialog__title">Edit next action deadline</div>
      <div className="processing-dialog__content">
        <NextActionDeadlineStep value={deadline} enableClearShortcut enableTodayShortcut onDeadlineChange={setDeadline} onDeadlineSelected={save} onBack={props.onClose} />
      </div>
    </section>
  );
}
