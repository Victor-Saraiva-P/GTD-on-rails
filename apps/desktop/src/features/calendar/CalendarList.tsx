import { InboxListStuff } from "../inbox/InboxListStuff";
import { calendarItemIconText } from "../lists/listThemes";
import type { Calendar } from "./types";

type CalendarListProps = {
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
};

/**
 * Renders calendars with the shared inbox row editing behavior.
 *
 * @example <CalendarList items={items} selectedId="calendar-1" ... />
 */
export function CalendarList({ items, selectedId, ...itemProps }: CalendarListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Calendars">
      {items.map((item) => (
        <InboxListStuff key={item.id} item={item} glyph={calendarItemIconText} selected={item.id === selectedId} editing={item.id === itemProps.editingId} {...itemProps} />
      ))}
    </ol>
  );
}
