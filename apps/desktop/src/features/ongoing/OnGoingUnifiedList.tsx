import type { OnGoingItemSelection } from "./combinedOnGoingState";
import { OnGoingUnifiedListCard } from "./OnGoingUnifiedListCard";

export type OnGoingUnifiedListProps = Readonly<{
  items: OnGoingItemSelection[];
  editingId: string | null;
  editingTitle: string;
  editingTitleError: string | null;
  selectedId: string;
  onCancelEditing: () => void;
  onCommitEditing: () => void;
  onCommitEditingAndContinue: () => void;
  onEditingTitleChange: (value: string) => void;
  onSelect: (id: string) => void;
  onStartEditing: () => void;
}>;

export function OnGoingUnifiedList({
  items,
  editingId,
  editingTitle,
  editingTitleError,
  selectedId,
  onCancelEditing,
  onCommitEditing,
  onCommitEditingAndContinue,
  onEditingTitleChange,
  onSelect,
  onStartEditing
}: OnGoingUnifiedListProps) {
  return (
    <div className="tree-list__scroll-container">
      <ol className="tree-list tree-list--inbox" aria-label="On going items">
        {items.map((selection) => (
          <OnGoingUnifiedListCard
            key={selection.item.id}
            selection={selection}
            selected={selectedId === selection.item.id}
            editing={editingId === selection.item.id}
            editingTitle={editingTitle}
            editingTitleError={editingTitleError}
            onSelect={onSelect}
            onEditingTitleChange={onEditingTitleChange}
            onStartEditing={onStartEditing}
            onCommitEditing={onCommitEditing}
            onCommitEditingAndContinue={onCommitEditingAndContinue}
            onCancelEditing={onCancelEditing}
          />
        ))}
      </ol>
    </div>
  );
}
