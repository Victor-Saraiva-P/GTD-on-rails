import type { Stuff } from "./types";

type InboxListStuffProps = {
  item: Stuff;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function InboxListStuff({ item, selected, onSelect }: InboxListStuffProps) {
  return (
    <li className="tree-list__item">
      <button
        type="button"
        className={`tree-entry${selected ? " tree-entry--active" : ""}`}
        onClick={() => onSelect(item.id)}
      >
        <span className="tree-entry__marker">{selected ? "●" : "○"}</span>
        <img src="/inbox/stuff icon.png" alt="" className="tree-entry__icon" />
        <span className="tree-entry__label">{item.title}</span>
      </button>
    </li>
  );
}
