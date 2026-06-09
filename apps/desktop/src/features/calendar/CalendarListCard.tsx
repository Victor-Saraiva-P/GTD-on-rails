import type { KeyboardEvent } from "react";
import { InlineTitleInput } from "../../components/InlineTitleInput";
import type { Calendar } from "./types";
import { calendarItemIconText } from "../lists/listThemes";
import { trimCalendarDisplayTime } from "./calendarDateUtils";

type CalendarListCardProps = Readonly<{
  archiveStatus?: "deleted";
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
}>;

function calendarGlyphClassName(status: string, archiveStatus?: "deleted"): string {
  if (archiveStatus === "deleted") return "tree-entry__glyph--calendar-deleted";
  if (status === "CALENDAR") return "tree-entry__glyph--calendar-active";
  if (status === "ONGOING") return "tree-entry__glyph--calendar-ongoing";
  if (status === "DONE") return "tree-entry__glyph--calendar-done";
  return "";
}

function CalendarGlyph({ archiveStatus, status }: Readonly<{ archiveStatus?: "deleted", status: string }>) {
  const statusClassName = calendarGlyphClassName(status, archiveStatus);
  const className = `tree-entry__glyph tree-entry__glyph--stuff${statusClassName ? ` ${statusClassName}` : ""}`;

  return (
    <span className={className} aria-hidden="true">
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

function EditingCalendarCard(props: Readonly<Omit<CalendarListCardProps, "editing" | "onSelect" | "onStartEditing">>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    handleEditKeyDown(event, props.onCommitEditingAndContinue, props.onCancelEditing);
  };
  const displayTime = trimCalendarDisplayTime(props.item.scheduledTime);

  return (
    <li className="tree-list__item">
      <div className="tree-entry tree-entry--active calendar-item-entry">
        <CalendarGlyph archiveStatus={props.archiveStatus} status={props.item.status} />
        <InlineTitleInput debugPhasePrefix="calendar-title" initialValue={props.editingTitle} onBlur={props.onCommitEditing} onEditKeyDown={handleKeyDown} onValueChange={props.onEditingTitleChange} />
        {displayTime ? (
          <span className="calendar-entry__time">
            <span aria-hidden="true">⏱</span>
            <span>{displayTime}</span>
          </span>
        ) : null}
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
    <li className="tree-list__item">
      <button
        type="button"
        className={`tree-entry calendar-item-entry${selected ? " tree-entry--active" : ""}`}
        onClick={() => onSelect(item.id)}
        onDoubleClick={() => handleSelectDoubleClick(props)}
      >
        <CalendarGlyph archiveStatus={props.archiveStatus} status={item.status} />
        <span className="tree-entry__label">{item.title}</span>
        {displayTime ? (
          <span className="calendar-entry__time">
            <span aria-hidden="true">⏱</span>
            <span>{displayTime}</span>
          </span>
        ) : null}
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
