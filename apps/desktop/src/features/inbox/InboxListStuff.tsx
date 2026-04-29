import type { KeyboardEvent } from "react";
import type { Stuff } from "./types";

type InboxListStuffProps = {
  item: Stuff;
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

function InboxStuffGlyph() {
  return (
    <span className="tree-entry__glyph tree-entry__glyph--stuff" aria-hidden="true">
      S
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

function EditingInboxListStuff(props: Omit<InboxListStuffProps, "editing" | "onSelect" | "onStartEditing">) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    handleEditKeyDown(event, props.onCommitEditingAndContinue, props.onCancelEditing);
  };

  return (
    <li className="tree-list__item">
      <div className="tree-entry tree-entry--active">
        <span className="tree-entry__marker">{props.selected ? "●" : "○"}</span>
        <InboxStuffGlyph />
        <InboxStuffTitleInput
          value={props.editingTitle}
          onChange={props.onEditingTitleChange}
          onBlur={props.onCommitEditing}
          onKeyDown={handleKeyDown}
        />
      </div>
    </li>
  );
}

type InboxStuffTitleInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

function InboxStuffTitleInput({ value, onChange, onBlur, onKeyDown }: InboxStuffTitleInputProps) {
  return (
    <input
      value={value}
      className="tree-entry__input"
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      autoFocus
    />
  );
}

function handleSelectDoubleClick(props: Pick<InboxListStuffProps, "item" | "selected" | "onSelect" | "onStartEditing">) {
  props.onSelect(props.item.id);

  if (props.selected) {
    props.onStartEditing();
  }
}

function ReadOnlyInboxListStuff(props: InboxListStuffProps) {
  const { item, selected, onSelect } = props;

  return (
    <li className="tree-list__item">
      <button
        type="button"
        className={`tree-entry${selected ? " tree-entry--active" : ""}`}
        onClick={() => onSelect(item.id)}
        onDoubleClick={() => handleSelectDoubleClick(props)}
      >
        <span className="tree-entry__marker">{selected ? "●" : "○"}</span>
        <InboxStuffGlyph />
        <span className="tree-entry__label">{item.title}</span>
      </button>
    </li>
  );
}

export function InboxListStuff(props: InboxListStuffProps) {
  if (props.editing) {
    return <EditingInboxListStuff {...props} />;
  }

  return <ReadOnlyInboxListStuff {...props} />;
}
