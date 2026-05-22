import { calendarItemIconText } from "../lists/listThemes";
import type { Calendar } from "./types";
import { CalendarListCard } from "./CalendarListCard";

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
    <ul className="calendar-card-list" aria-label="Calendars">
      {items.map((item) => (
        <CalendarListCard key={item.id} item={item} selected={item.id === selectedId} editing={item.id === itemProps.editingId} {...itemProps} />
      ))}
    </ul>
  );
}
