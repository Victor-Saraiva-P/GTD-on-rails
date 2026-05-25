import type { KeyboardEvent } from "react";
import type { Calendar } from "./types";
import { calendarItemIconText } from "../lists/listThemes";
import { trimCalendarDisplayTime } from "./calendarDateUtils";

type CalendarListCardProps = {
  item: Calendar;
  selected: boolean;
  editing: boolean;
  editingTitle: string;
  onSelect: (id: string) => void;
  onEditingTitleChange: (value: string) => void;
  onStartEditing: () => void;
  onCommitEditing: () => void;
  onCommitEditingAndContinue: () => void;
  onCancelEditing: () => void;
};

function CalendarGlyph() {
  return (
    <span className="calendar-card__glyph" aria-hidden="true">
      {calendarItemIconText}
    </span>
  );
}

function handleEditKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onCommitEditingAndContinue: () => void,
  onCancelEditing: () => void
) {
  if (event.key === "Enter") {
    event.preventDefault();
    onCommitEditingAndContinue();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    onCancelEditing();
  }
}

function EditingCalendarCard(props: Omit<CalendarListCardProps, "editing" | "onSelect" | "onStartEditing">) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    handleEditKeyDown(event, props.onCommitEditingAndContinue, props.onCancelEditing);
  };
  const displayTime = trimCalendarDisplayTime(props.item.scheduledTime);

  return (
    <li className="calendar-list__item">
      <div className="calendar-card calendar-card--active">
        <div className="calendar-card__title-row">
          <CalendarGlyph />
          <input
            value={props.editingTitle}
            className="calendar-card__input"
            onChange={(event) => props.onEditingTitleChange(event.target.value)}
            onBlur={props.onCommitEditing}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        {displayTime && (
          <div className="calendar-card__time-row">
            <span aria-hidden="true">⏱</span>
            <span>{displayTime}</span>
          </div>
        )}
      </div>
    </li>
  );
}

function handleSelectDoubleClick(props: Pick<CalendarListCardProps, "item" | "selected" | "onSelect" | "onStartEditing">) {
  props.onSelect(props.item.id);

  if (props.selected) {
    props.onStartEditing();
  }
}

function ReadOnlyCalendarCard(props: CalendarListCardProps) {
  const { item, selected, onSelect } = props;
  const displayTime = trimCalendarDisplayTime(item.scheduledTime);

  return (
    <li className="calendar-list__item">
      <button
        type="button"
        className={`calendar-card${selected ? " calendar-card--active" : ""}`}
        onClick={() => onSelect(item.id)}
        onDoubleClick={() => handleSelectDoubleClick(props)}
      >
        <div className="calendar-card__title-row">
          <CalendarGlyph />
          <span className="calendar-card__title">{item.title}</span>
        </div>
        {displayTime && (
          <div className="calendar-card__time-row">
            <span aria-hidden="true" className="calendar-card__time-icon">⏱</span>
            <span>{displayTime}</span>
          </div>
        )}
      </button>
    </li>
  );
}

export function CalendarListCard(props: CalendarListCardProps) {
  if (props.editing) {
    return <EditingCalendarCard {...props} />;
  }

  return <ReadOnlyCalendarCard {...props} />;
}
