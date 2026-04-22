import { useMemo } from "react";
import { useKeybindContext } from "./KeybindProvider";

const zoneLabels = {
  "inbox-list": "Inbox list",
  "stuff-detail": "Stuff detail",
  "context-list": "Contexts list",
  "context-detail": "Context detail"
};

export function LeaderMenu() {
  const { activeZone, closeLeaderMenu, getAvailableLeaderBindings, isLeaderMenuOpen, leaderPath } =
    useKeybindContext();

  const bindings = useMemo(() => getAvailableLeaderBindings(), [getAvailableLeaderBindings]);

  if (!isLeaderMenuOpen) {
    return null;
  }

  return (
    <div className="leader-menu" role="dialog" aria-label="Leader key menu">
      <div className="leader-menu__header">
        <span className="leader-menu__badge">Space</span>
        <span className="leader-menu__title">
          {leaderPath.length > 0 ? `Space ${leaderPath.join(" ")}` : "Space"}
        </span>
      </div>
      <div className="leader-menu__subtitle">{zoneLabels[activeZone]}</div>
      <div className="leader-menu__list" role="list">
        {bindings.map((binding) => (
          <div key={binding.id} className="leader-menu__item" role="listitem">
            <kbd>{binding.key}</kbd>
            <span>{binding.description}</span>
          </div>
        ))}
      </div>
      <button type="button" className="leader-menu__hint" onClick={closeLeaderMenu}>
        Esc to close
      </button>
    </div>
  );
}
