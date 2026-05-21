import { InboxStuffDetails } from "../inbox/InboxStuffDetails";
import type { ItemBody } from "../inbox/types";
import type { Calendar } from "./types";

type CalendarDetailsProps = {
  item: Calendar;
  editing: boolean;
  onAutosaveEditing: (body: ItemBody) => Promise<void>;
  onCommitEditing: (body: ItemBody) => Promise<void>;
  onExitEditingFromNormalMode: (body: ItemBody) => Promise<void>;
  onCancelEditing: () => void;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
};

/**
 * Renders calendar detail metadata and the shared rich item body.
 *
 * @example <CalendarDetails item={calendar} editing={false} ... />
 */
export function CalendarDetails(props: CalendarDetailsProps) {
  return (
    <InboxStuffDetails
      item={props.item}
      showCreatedMeta={false}
      metaVariant="calendar"
      editing={props.editing}
      onAutosaveEditing={props.onAutosaveEditing}
      onCommitEditing={props.onCommitEditing}
      onExitEditingFromNormalMode={props.onExitEditingFromNormalMode}
      onCancelEditing={props.onCancelEditing}
      onVimModeChange={props.onVimModeChange}
    />
  );
}
