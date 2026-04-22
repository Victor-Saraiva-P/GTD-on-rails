import { ContextItemsList } from "./ContextItemsList";
import type { ContextItem, ContextRelatedItem } from "./types";

type ContextItemsPaneProps = {
  context: ContextItem;
  items: ContextRelatedItem[];
};

export function ContextItemsPane({ context, items }: ContextItemsPaneProps) {
  return (
    <div className="context-items-pane">
      <p className="inbox-detail__meta">Showing latest related items for {context.name}</p>
      <ContextItemsList items={items} />
    </div>
  );
}
