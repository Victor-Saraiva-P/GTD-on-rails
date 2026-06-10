import { ContextsListItem } from "./ContextsListItem";
import type { ContextItem } from "./types";

type ContextsListProps = Readonly<{
  items: ContextItem[];
  editingTitleError: string | null;
  selectedId: string;
  editingId: string | null;
  editingName: string;
  onSelect: (id: string) => void;
  onEditingNameChange: (value: string) => void;
  onStartEditing: () => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
}>;

type ContextsListRowProps = Readonly<Omit<ContextsListProps, "items"> & {
  item: ContextItem;
}>;

function ContextsListRow({
  item,
  selectedId,
  editingId,
  editingTitleError,
  ...props
}: ContextsListRowProps) {
  return (
    <ContextsListItem
      item={item}
      editingTitleError={item.id === editingId ? editingTitleError : null}
      selected={item.id === selectedId}
      editing={item.id === editingId}
      {...props}
    />
  );
}

/**
 * Renders the context collection with editable rows.
 *
 * @example <ContextsList items={contexts} selectedId={selectedId} ... />
 */
export function ContextsList({
  items,
  ...itemProps
}: ContextsListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Contexts">
      {items.map((item) => (
        <ContextsListRow key={item.id} item={item} {...itemProps} />
      ))}
    </ol>
  );
}
