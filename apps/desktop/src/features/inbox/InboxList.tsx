import type { Stuff } from "./types";
import { InboxListStuff } from "./InboxListStuff";

type InboxListProps = Readonly<{
  items: Stuff[];
  editingTitleError: string | null;
  selectedId: string;
  editingId: string | null;
  editingTitle: string;
  onSelect: (id: string) => void;
  onEditingTitleChange: (value: string) => void;
  onStartEditing: () => void;
  onCommitEditing: () => void;
  onCommitEditingAndContinue: () => void;
  onCancelEditing: () => void;
}>;

type InboxListItemProps = Readonly<Omit<InboxListProps, "items"> & {
  item: Stuff;
}>;

function InboxListItem({
  item,
  selectedId,
  editingId,
  editingTitleError,
  ...props
}: InboxListItemProps) {
  return (
    <InboxListStuff
      item={item}
      editingTitleError={item.id === editingId ? editingTitleError : null}
      selected={item.id === selectedId}
      editing={item.id === editingId}
      {...props}
    />
  );
}

/**
 * Renders the inbox collection with editable stuff rows.
 *
 * @example <InboxList items={stuffs} selectedId={selectedId} ... />
 */
export function InboxList({
  items,
  ...itemProps
}: InboxListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Inbox items">
      {items.map((item) => (
        <InboxListItem key={item.id} item={item} {...itemProps} />
      ))}
    </ol>
  );
}
