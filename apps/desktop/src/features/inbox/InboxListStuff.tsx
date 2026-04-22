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

export function InboxListStuff({
  item,
  selected,
  editing,
  editingTitle,
  onSelect,
  onEditingTitleChange,
  onStartEditing,
  onCommitEditing,
  onCommitEditingAndContinue,
  onCancelEditing
}: InboxListStuffProps) {
  if (editing) {
    return (
      <li className="tree-list__item">
        <div className="tree-entry tree-entry--active">
          <span className="tree-entry__marker">{selected ? "●" : "○"}</span>
          <img src="/inbox/stuff icon.png" alt="" className="tree-entry__icon" />
          <input
            value={editingTitle}
            className="tree-entry__input"
            onChange={(event) => onEditingTitleChange(event.target.value)}
            onBlur={onCommitEditing}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitEditingAndContinue();
              }

              if (event.key === "Escape") {
                event.preventDefault();
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
        className={`tree-entry${selected ? " tree-entry--active" : ""}`}
        onClick={() => onSelect(item.id)}
        onDoubleClick={() => {
          onSelect(item.id);

          if (selected) {
            onStartEditing();
          }
        }}
      >
        <span className="tree-entry__marker">{selected ? "●" : "○"}</span>
        <img src="/inbox/stuff icon.png" alt="" className="tree-entry__icon" />
        <span className="tree-entry__label">{item.title}</span>
      </button>
    </li>
  );
}
