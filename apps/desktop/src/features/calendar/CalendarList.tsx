import type { Calendar } from "./types";
import { CalendarListCard } from "./CalendarListCard";

type CalendarListProps = Readonly<{
  archiveStatus?: "deleted";
  editingId: string | null;
  editingTitle: string;
  items: Calendar[];
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
export function CalendarList({ archiveStatus, items, selectedId, ...itemProps }: CalendarListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Calendars">
      {items.map((item) => (
        <CalendarListCard key={item.id} archiveStatus={archiveStatus} item={item} selected={item.id === selectedId} editing={item.id === itemProps.editingId} {...itemProps} />
      ))}
    </ol>
  );
}
