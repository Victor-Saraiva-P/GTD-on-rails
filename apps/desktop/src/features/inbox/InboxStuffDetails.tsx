import { getStuffBodyLines, type Stuff } from "./types";

type InboxStuffDetailsProps = {
  item: Stuff;
};

export function InboxStuffDetails({ item }: InboxStuffDetailsProps) {
  const details = getStuffBodyLines(item.body);

  if (details.length === 0) {
    return <p className="pane-state">No details yet for this stuff.</p>;
  }

  return (
    <div className="detail-card">
      <ul className="detail-list" aria-label="Selected item details">
        {details.map((detail) => (
          <li key={detail} className="detail-list__item">
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
