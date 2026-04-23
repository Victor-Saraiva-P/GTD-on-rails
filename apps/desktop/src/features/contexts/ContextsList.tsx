import { ContextsListItem } from "./ContextsListItem";
import type { ContextItem } from "./types";

type ContextsListProps = {
  items: ContextItem[];
  selectedId: string;
  editingId: string | null;
  editingName: string;
  onSelect: (id: string) => void;
  onEditingNameChange: (value: string) => void;
  onStartEditing: () => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
};

export function ContextsList({
  items,
  selectedId,
  editingId,
  editingName,
  onSelect,
  onEditingNameChange,
  onStartEditing,
  onCommitEditing,
  onCancelEditing
}: ContextsListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Contexts">
      {items.map((item) => (
        <ContextsListItem
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          editing={item.id === editingId}
          editingName={editingName}
          onSelect={onSelect}
          onEditingNameChange={onEditingNameChange}
          onStartEditing={onStartEditing}
          onCommitEditing={onCommitEditing}
          onCancelEditing={onCancelEditing}
        />
      ))}
    </ol>
  );
}
