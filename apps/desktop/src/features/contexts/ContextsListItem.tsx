import { useRef } from "react";
import type { ContextItem } from "./types";

type ContextsListItemProps = {
  item: ContextItem;
  selected: boolean;
  editing: boolean;
  editingName: string;
  onSelect: (id: string) => void;
  onEditingNameChange: (value: string) => void;
  onStartEditing: () => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
};

export function ContextsListItem({
  item,
  selected,
  editing,
  editingName,
  onSelect,
  onEditingNameChange,
  onStartEditing,
  onCommitEditing,
  onCancelEditing
}: ContextsListItemProps) {
  const skipBlurCommitRef = useRef(false);

  if (editing) {
    return (
      <li className="tree-list__item">
        <div className="tree-entry tree-entry--active context-tree-entry">
          <input
            value={editingName}
            className="tree-entry__input"
            onChange={(event) => onEditingNameChange(event.target.value)}
            onBlur={() => {
              if (skipBlurCommitRef.current) {
                skipBlurCommitRef.current = false;
                return;
              }

              onCommitEditing();
            }}
            onKeyDown={(event) => {
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
            }}
            autoFocus
          />
        </div>
      </li>
    );
  }

  return (
    <li className="tree-list__item">
      <button
        type="button"
        className={`tree-entry context-tree-entry${selected ? " tree-entry--active" : ""}`}
        onClick={() => onSelect(item.id)}
        onDoubleClick={() => {
          onSelect(item.id);

          if (selected) {
            onStartEditing();
          }
        }}
      >
        <span className="tree-entry__label">{item.name}</span>
      </button>
    </li>
  );
}
