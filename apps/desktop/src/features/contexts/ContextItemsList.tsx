import type { ContextRelatedItem } from "./types";

type ContextItemsListProps = {
  items: ContextRelatedItem[];
};

export function ContextItemsList({ items }: ContextItemsListProps) {
  return (
    <ol className="tree-list tree-list--inbox context-item-list" aria-label="Related items">
      {items.map((item) => (
        <li key={item.id} className="tree-list__item">
          <div className="tree-entry context-item-entry">
            <img src="/inbox/stuff icon.png" alt="" className="tree-entry__icon" />
            <span className="tree-entry__label">{item.title}</span>
            <span className="context-item-entry__status">{item.status}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
