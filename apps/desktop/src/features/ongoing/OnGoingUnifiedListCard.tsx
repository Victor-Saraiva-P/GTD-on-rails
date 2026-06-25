import type { KeyboardEvent } from "react";
import { InlineTitleInput } from "../../components/InlineTitleInput";
import type { OnGoingItemSelection } from "./combinedOnGoingState";
import { calendarItemIconText } from "../lists/listThemes";

type OnGoingUnifiedListCardProps = Readonly<{
  selection: OnGoingItemSelection;
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

function unifiedGlyphClassName(selection: OnGoingItemSelection): string {
  if (selection.type === "calendar") return "tree-entry__glyph--calendar-ongoing";
  return "tree-entry__glyph--next-action";
}

function UnifiedGlyph({ selection }: Readonly<{ selection: OnGoingItemSelection }>) {
  const statusClassName = unifiedGlyphClassName(selection);
  const className = ["tree-entry__glyph", "tree-entry__glyph--stuff", statusClassName].filter(Boolean).join(" ");
  const icon = selection.type === "calendar" ? calendarItemIconText : "N";

  return (
    <span className={className} aria-hidden="true">
      {icon}
    </span>
  );
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

function EditingUnifiedCard(props: Readonly<Omit<OnGoingUnifiedListCardProps, "editing" | "onSelect" | "onStartEditing">>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    handleEditKeyDown(event, props.onCommitEditingAndContinue);
  };

  return (
    <li className="tree-list__item">
      <div className="tree-entry tree-entry--active unified-item-entry">
        <UnifiedGlyph selection={props.selection} />
        <div className="tree-entry__edit">
          <InlineTitleInput initialValue={props.editingTitle} onBlur={props.onCommitEditing} onEditKeyDown={handleKeyDown} onValueChange={props.onEditingTitleChange} />
          {props.editingTitleError ? <p className="tree-entry__error">{props.editingTitleError}</p> : null}
        </div>
      </div>
    </li>
  );
}

function handleSelectDoubleClick(props: Pick<OnGoingUnifiedListCardProps, "selection" | "selected" | "onSelect" | "onStartEditing">) {
  props.onSelect(props.selection.item.id);

  if (props.selected) {
    props.onStartEditing();
  }
}

function ReadOnlyUnifiedCard(props: OnGoingUnifiedListCardProps) {
  const { selection, selected, onSelect } = props;

  return (
    <li className="tree-list__item">
      <button
        type="button"
        className={`tree-entry unified-item-entry${selected ? " tree-entry--active" : ""}`}
        onClick={() => onSelect(selection.item.id)}
        onDoubleClick={() => handleSelectDoubleClick(props)}
      >
        <UnifiedGlyph selection={selection} />
        <span className="tree-entry__label">{selection.item.title}</span>
      </button>
    </li>
  );
}

export function OnGoingUnifiedListCard(props: OnGoingUnifiedListCardProps) {
  if (props.editing) {
    return <EditingUnifiedCard {...props} />;
  }

  return <ReadOnlyUnifiedCard {...props} />;
}
