import { ContextItemsList } from "./ContextItemsList";
import type { ContextItem, ContextRelatedItem } from "./types";

type ContextItemsPaneProps = {
  context: ContextItem;
  items: ContextRelatedItem[];
};

/**
 * Shows the selected context summary alongside its related item list.
 *
 * @example <ContextItemsPane context={context} items={items} />
 */
export function ContextItemsPane({ context, items }: ContextItemsPaneProps) {
  return (
    <div className="context-items-pane">
      <p className="inbox-detail__meta">Showing latest related items for {context.name}</p>
      <ContextItemsList items={items} />
    </div>
  );
}
