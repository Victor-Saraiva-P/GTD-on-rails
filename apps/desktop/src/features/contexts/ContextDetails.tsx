import type { ContextItem } from "./types";

type ContextDetailsProps = {
  item: ContextItem;
};

export function ContextDetails({ item }: ContextDetailsProps) {
  return (
    <div className="detail-card">
      <p className="detail-card__meta">Context identifier</p>
      <ul className="detail-list" aria-label="Selected context details">
        <li className="detail-list__item">{item.id}</li>
      </ul>
    </div>
  );
}
