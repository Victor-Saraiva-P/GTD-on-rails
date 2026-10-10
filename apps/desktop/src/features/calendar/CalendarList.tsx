import type { CalendarTemporalState, CalendarWorkspaceItem } from "./types";
import { CalendarListCard } from "./CalendarListCard";

type CalendarListProps = Readonly<{
  archiveStatus?: "deleted";
  editingTitleError: string | null;
  editingId: string | null;
  editingTitle: string;
  items: CalendarWorkspaceItem[];
  grouped?: boolean;
  onCancelEditing: () => void;
  onCommitEditing: () => void;
  onCommitEditingAndContinue: () => void;
  onEditingTitleChange: (value: string) => void;
  onSelect: (id: string) => void;
  onStartEditing: () => void;
  selectedId: string;
}>;

/**
 * Renders calendars with the shared inbox row editing behavior.
 *
 * @example <CalendarList items={items} selectedId="calendar-1" ... />
 */
export function CalendarList({ archiveStatus, grouped = false, items, selectedId, ...itemProps }: CalendarListProps) {
  let previousState: CalendarTemporalState | undefined;
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Calendars">
      {items.map((item) => {
        const state = grouped && "temporalState" in item ? item.temporalState : undefined;
        const showHeader = Boolean(state && state !== previousState);
        previousState = state;
        return (
          <CalendarListRow key={item.id} item={item} showHeader={showHeader} state={state} archiveStatus={archiveStatus} selectedId={selectedId} itemProps={itemProps} />
        );
      })}
    </ol>
  );
}

function CalendarListRow(props: Readonly<{
  item: CalendarWorkspaceItem;
  showHeader: boolean;
  state?: CalendarTemporalState;
  archiveStatus?: "deleted";
  selectedId: string;
  itemProps: Omit<CalendarListProps, "archiveStatus" | "grouped" | "items" | "selectedId">;
}>) {
  return (
    <>
      {props.showHeader ? <li className="calendar-group-heading" aria-hidden="true">{calendarGroupLabel(props.state)}</li> : null}
      <CalendarListCard archiveStatus={props.archiveStatus} item={props.item} selected={props.item.id === props.selectedId} editing={props.item.id === props.itemProps.editingId} {...props.itemProps} />
    </>
  );
}

function calendarGroupLabel(state?: CalendarTemporalState): string {
  if (state === "SCHEDULED_TODAY") return "Scheduled today";
  if (state === "OVERDUE") return "Overdue";
  return "Due today";
}
