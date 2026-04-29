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

type ContextsListRowProps = Omit<ContextsListProps, "items"> & {
  item: ContextItem;
};

function ContextsListRow({
  item,
  selectedId,
  editingId,
  ...props
}: ContextsListRowProps) {
  return (
    <ContextsListItem
      item={item}
      selected={item.id === selectedId}
      editing={item.id === editingId}
      {...props}
    />
  );
}

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
