import type { Stuff } from "./types";
import { InboxListStuff } from "./InboxListStuff";

type InboxListProps = {
  items: Stuff[];
  selectedId: string;
  editingId: string | null;
  editingTitle: string;
  onSelect: (id: string) => void;
  onEditingTitleChange: (value: string) => void;
  onStartEditing: () => void;
  onCommitEditing: () => void;
  onCommitEditingAndContinue: () => void;
  onCancelEditing: () => void;
};

export function InboxList({
  items,
  selectedId,
  editingId,
  editingTitle,
  onSelect,
  onEditingTitleChange,
  onStartEditing,
  onCommitEditing,
  onCommitEditingAndContinue,
  onCancelEditing
}: InboxListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Inbox items">
      {items.map((item) => (
        <InboxListStuff
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          editing={item.id === editingId}
          editingTitle={editingTitle}
          onSelect={onSelect}
          onEditingTitleChange={onEditingTitleChange}
          onStartEditing={onStartEditing}
          onCommitEditing={onCommitEditing}
          onCommitEditingAndContinue={onCommitEditingAndContinue}
          onCancelEditing={onCancelEditing}
        />
      ))}
    </ol>
  );
}
