import type { Stuff } from "./types";

type InboxStuffDetailsProps = {
  item: Stuff;
};

export function InboxStuffDetails({ item }: InboxStuffDetailsProps) {
  return (
    <div className="detail-card">
      <ul className="detail-list" aria-label="Selected item details">
        {item.details.map((detail) => (
          <li key={detail} className="detail-list__item">
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
