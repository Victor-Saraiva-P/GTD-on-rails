import type { KeyboardEvent } from "react";
import { InlineTitleInput } from "../../components/InlineTitleInput";
import type { CalendarWorkspaceItem } from "./types";
import { isNextActionCalendarEntry } from "./types.ts";
import { calendarItemIconText } from "../lists/listThemes";
import { useScrollIntoViewWhenSelected } from "../lists/useScrollIntoViewWhenSelected";
import { calendarEntryDisplayTime } from "./calendarDateUtils";
import { ProjectAssociationMarker } from "../projects/ProjectAssociationMarker";
import { TitleSearchHighlight } from "../title-search/TitleSearchHighlight";

type CalendarListCardProps = Readonly<{
  archiveStatus?: "deleted";
  item: CalendarWorkspaceItem;
  editingTitleError: string | null;
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

function CalendarGlyph({ archiveStatus, item }: Readonly<{ archiveStatus?: "deleted", item: CalendarWorkspaceItem }>) {
  if (isNextActionCalendarEntry(item)) {
    return <span className="tree-entry__glyph tree-entry__glyph--next-action" aria-hidden="true">N</span>;
  }
  const statusClassName = calendarGlyphClassName(item.status, archiveStatus);
  const className = `tree-entry__glyph tree-entry__glyph--stuff${statusClassName ? ` ${statusClassName}` : ""}`;
  return <span className={className} aria-hidden="true">{calendarItemIconText}</span>;
}

function calendarTemporalLabel(item: CalendarWorkspaceItem): string | null {
  if (!isNextActionCalendarEntry(item)) return null;
  if (item.temporalState === "DUE_TODAY") return "due today";
  if (item.temporalState === "OVERDUE") return `overdue · ${shortDeadline(item.deadline)}`;
  if (item.temporalState === "WEEK") return `due ${shortDeadline(item.deadline)}`;
  if (item.temporalState === "DONE_TODAY") return "done today";
  return null;
}

function shortDeadline(deadline?: string | null): string {
  if (!deadline) return "";
  return new Date(`${deadline}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function handleEditKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onCommitEditingAndContinue: () => void
) {
  if (event.key === "Enter") {
    event.preventDefault();
    onCommitEditingAndContinue();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    onCommitEditingAndContinue();
  }
}

function EditingCalendarCard(props: Readonly<Omit<CalendarListCardProps, "editing" | "onSelect" | "onStartEditing">>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    handleEditKeyDown(event, props.onCommitEditingAndContinue);
  };
  const temporalState = "temporalState" in props.item ? props.item.temporalState : undefined;
  const displayTime = calendarEntryDisplayTime(props.item.scheduledTime, temporalState, props.item.schedule);

  return (
    <li className="tree-list__item">
      <div className={`tree-entry tree-entry--active calendar-item-entry${props.item.projectTitle ? " calendar-item-entry--project-associated" : ""}`}>
        <CalendarGlyph archiveStatus={props.archiveStatus} item={props.item} />
        <div className="tree-entry__edit">
          <InlineTitleInput initialValue={props.editingTitle} onBlur={props.onCommitEditing} onEditKeyDown={handleKeyDown} onValueChange={props.onEditingTitleChange} />
          {props.editingTitleError ? <p className="tree-entry__error">{props.editingTitleError}</p> : null}
        </div>
        <ProjectAssociationMarker projectTitle={props.item.projectTitle} placement="list" />
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

function CalendarCardBody({ item, archiveStatus }: Readonly<{ item: CalendarWorkspaceItem; archiveStatus?: "deleted" }>) {
  const temporalState = "temporalState" in item ? item.temporalState : undefined;
  const displayTime = calendarEntryDisplayTime(item.scheduledTime, temporalState, item.schedule);
  const temporalLabel = calendarTemporalLabel(item);
  return (
    <>
      <CalendarGlyph archiveStatus={archiveStatus} item={item} />
      <span className="tree-entry__label">
        <TitleSearchHighlight title={item.title} itemId={item.id} />
      </span>
      <ProjectAssociationMarker projectTitle={item.projectTitle} placement="list" />
      {displayTime ? (
        <span className="calendar-entry__time">
          <span aria-hidden="true">⏱</span>
          <span>{displayTime}</span>
        </span>
      ) : null}
      {temporalLabel ? <span className="calendar-entry__deadline">{temporalLabel}</span> : null}
    </>
  );
}

function ReadOnlyCalendarCard(props: CalendarListCardProps) {
  const buttonRef = useScrollIntoViewWhenSelected(props.selected);
  const activeClass = props.selected ? " tree-entry--active" : "";
  const projectClass = props.item.projectTitle ? " calendar-item-entry--project-associated" : "";

  return (
    <li className="tree-list__item">
      <button
        ref={buttonRef}
        type="button"
        className={`tree-entry calendar-item-entry${activeClass}${projectClass}`}
        onClick={() => props.onSelect(props.item.id)}
        onDoubleClick={() => handleSelectDoubleClick(props)}
      >
        <CalendarCardBody item={props.item} archiveStatus={props.archiveStatus} />
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
