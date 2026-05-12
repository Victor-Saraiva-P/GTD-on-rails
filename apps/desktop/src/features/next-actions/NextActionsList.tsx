import { InboxListStuff } from "../inbox/InboxListStuff";
import type { NextAction } from "./types";

type NextActionsListProps = {
  items: NextAction[];
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

type NextActionRowProps = Omit<NextActionsListProps, "items"> & {
  item: NextAction;
};

function NextActionRow({ item, selectedId, editingId, ...props }: NextActionRowProps) {
  return (
    <InboxListStuff
      glyph="N"
      item={item}
      selected={item.id === selectedId}
      editing={item.id === editingId}
      {...props}
    />
  );
}

/**
 * Renders next actions with the shared inbox row editing behavior.
 *
 * @example <NextActionsList items={items} selectedId={selectedId} ... />
 */
export function NextActionsList({ items, ...itemProps }: NextActionsListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Next actions">
      {items.map((item) => <NextActionRow key={item.id} item={item} {...itemProps} />)}
    </ol>
  );
}
