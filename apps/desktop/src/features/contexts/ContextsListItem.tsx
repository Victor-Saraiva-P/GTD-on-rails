import { useRef, type KeyboardEvent, type MutableRefObject } from "react";
import { InlineTitleInput } from "../../components/InlineTitleInput";
import { buildApiUrlWithVersion } from "../../config/env.ts";
import type { ContextItem } from "./types";

type ContextsListItemProps = Readonly<{
  item: ContextItem;
  selected: boolean;
  editing: boolean;
  editingName: string;
  onSelect: (id: string) => void;
  onEditingNameChange: (value: string) => void;
  onStartEditing: () => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
}>;

function ContextGlyph({ item }: Readonly<Pick<ContextsListItemProps, "item">>) {
  if (item.iconUrl) {
    return (
      <img
        src={buildApiUrlWithVersion(item.iconUrl, item.iconRevision)}
        alt=""
        className="tree-entry__icon"
        draggable={false}
      />
    );
  }

  return (
    <span className="tree-entry__glyph tree-entry__glyph--context" aria-hidden="true">
      C
    </span>
  );
}

function handleContextInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  skipBlurCommitRef: MutableRefObject<boolean>,
  onCommitEditing: () => void,
  onCancelEditing: () => void
) {
  if (event.key === "Enter") {
    event.preventDefault();
    skipBlurCommitRef.current = true;
    onCommitEditing();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    skipBlurCommitRef.current = true;
    onCancelEditing();
  }
}

function EditingContextsListItem(props: Readonly<Omit<ContextsListItemProps, "editing" | "onSelect" | "onStartEditing">>) {
  const skipBlurCommitRef = useRef(false);
  const handleBlur = () => handleContextInputBlur(skipBlurCommitRef, props.onCommitEditing);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    handleContextInputKeyDown(event, skipBlurCommitRef, props.onCommitEditing, props.onCancelEditing);
  };

  return <EditingContextEntry {...props} onBlur={handleBlur} onKeyDown={handleKeyDown} />;
}

function EditingContextEntry(
  props: Readonly<Omit<ContextsListItemProps, "editing" | "onSelect" | "onStartEditing"> & ContextNameInputEvents>
) {
  return (
    <li className="tree-list__item">
      <div className="tree-entry tree-entry--active context-tree-entry">
        <span className="tree-entry__marker">{props.selected ? "●" : "○"}</span>
        <ContextGlyph item={props.item} />
        <ContextNameInput
          initialValue={props.editingName}
          onChange={props.onEditingNameChange}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
        />
      </div>
    </li>
  );
}

type ContextNameInputEvents = {
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

type ContextNameInputProps = Readonly<{
  initialValue: string;
  onChange: (value: string) => void;
} & ContextNameInputEvents>;

function ContextNameInput({ initialValue, onChange, onBlur, onKeyDown }: ContextNameInputProps) {
  return (
    <InlineTitleInput initialValue={initialValue} onBlur={onBlur} onEditKeyDown={onKeyDown} onValueChange={onChange} />
  );
}

function handleContextInputBlur(
  skipBlurCommitRef: MutableRefObject<boolean>,
  onCommitEditing: () => void
) {
  if (skipBlurCommitRef.current) {
    skipBlurCommitRef.current = false;
    return;
  }

  onCommitEditing();
}

function handleContextDoubleClick(
  props: Pick<ContextsListItemProps, "item" | "selected" | "onSelect" | "onStartEditing">
) {
  props.onSelect(props.item.id);

  if (props.selected) {
    props.onStartEditing();
  }
}

function ReadOnlyContextsListItem(props: ContextsListItemProps) {
  const { item, selected, onSelect } = props;

  return (
    <li className="tree-list__item">
      <button
        type="button"
        className={`tree-entry context-tree-entry${selected ? " tree-entry--active" : ""}`}
        onClick={() => onSelect(item.id)}
        onDoubleClick={() => handleContextDoubleClick(props)}
      >
        <span className="tree-entry__marker">{selected ? "●" : "○"}</span>
        <ContextGlyph item={item} />
        <span className="tree-entry__label">{item.name}</span>
      </button>
    </li>
  );
}

/**
 * Renders one context row in either read-only or inline-edit mode.
 *
 * @example <ContextsListItem item={context} selected={true} editing={false} ... />
 */
export function ContextsListItem(props: ContextsListItemProps) {
  if (props.editing) {
    return <EditingContextsListItem {...props} />;
  }

  return <ReadOnlyContextsListItem {...props} />;
}
