import { InboxStuffDetails } from "../inbox/InboxStuffDetails";
import type { ItemBody, Stuff } from "../inbox/types";
import type { RecurringCalendarTemplate } from "./types";

type RecurringCalendarTemplateDetailsProps = Readonly<{
  editing: boolean;
  onAutosaveEditing: (body: ItemBody) => Promise<void>;
  onCancelEditing: () => void;
  onCommitEditing: (body: ItemBody) => Promise<void>;
  onExitEditingFromNormalMode: (body: ItemBody) => Promise<void>;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
  template: RecurringCalendarTemplate;
}>;

function recurringTemplateAsStuff(template: RecurringCalendarTemplate): Stuff {
  return { ...template, status: "RECURRING_TEMPLATE" };
}

/**
 * Renders selected recurring calendar template details with shared body editing.
 *
 * @example <RecurringCalendarTemplateDetails template={template} />
 */
export function RecurringCalendarTemplateDetails(props: RecurringCalendarTemplateDetailsProps) {
  return (
    <InboxStuffDetails
      item={recurringTemplateAsStuff(props.template)}
      showCreatedMeta={false}
      metaVariant="recurring-template"
      editing={props.editing}
      onAutosaveEditing={props.onAutosaveEditing}
      onCommitEditing={props.onCommitEditing}
      onExitEditingFromNormalMode={props.onExitEditingFromNormalMode}
      onCancelEditing={props.onCancelEditing}
      onVimModeChange={props.onVimModeChange}
    />
  );
}
