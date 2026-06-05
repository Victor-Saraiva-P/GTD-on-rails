import { ContextItemsList } from "./ContextItemsList";
import type { ContextItem, ContextRelatedItem } from "./types";

type ContextItemsViewProps = Readonly<{
  context: ContextItem;
  items: ContextRelatedItem[];
}>;

/**
 * Shows the selected context summary alongside its related item list.
 *
 * @example <ContextItemsView context={context} items={items} />
 */
export function ContextItemsView({ context, items }: ContextItemsViewProps) {
  return (
    <div className="context-items-pane">
      <p className="inbox-detail__meta">Showing latest related items for {context.name}</p>
      <ContextItemsList items={items} />
    </div>
  );
}
