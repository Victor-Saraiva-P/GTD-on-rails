import type { Stuff } from "./types";
import { InboxListStuff } from "./InboxListStuff";

type InboxListProps = {
  items: Stuff[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function InboxList({ items, selectedId, onSelect }: InboxListProps) {
  return (
    <ol className="tree-list" aria-label="Inbox items">
      {items.map((item) => (
        <InboxListStuff
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ol>
  );
}
