import { RecurringCalendarTemplateWizard } from "./RecurringCalendarTemplateWizard";
import type { RecurringCalendarTemplate, RecurringCalendarTemplateConversionPayload } from "./types";

type RecurringCalendarTemplateEditDialogProps = Readonly<{
  template: RecurringCalendarTemplate;
  onClose: () => void;
  onSave: (payload: RecurringCalendarTemplateConversionPayload) => Promise<void> | void;
}>;

/**
 * Dialog for editing a Recurring Calendar Template's recurrence rules.
 *
 * @example <RecurringCalendarTemplateEditDialog template={template} onClose={close} onSave={save} />
 */
export function RecurringCalendarTemplateEditDialog(props: RecurringCalendarTemplateEditDialogProps) {
  const handleConfirm = (payload: RecurringCalendarTemplateConversionPayload) => {
    void Promise.resolve(props.onSave(payload)).then(props.onClose);
  };

  return (
    <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Edit recurring template">
      <div className="processing-dialog__title">Edit recurring template</div>
      <div className="processing-dialog__content">
        <RecurringCalendarTemplateWizard
          initialDraft={props.template}
          onCancel={props.onClose}
          onConfirm={handleConfirm}
        />
      </div>
    </section>
  );
}
