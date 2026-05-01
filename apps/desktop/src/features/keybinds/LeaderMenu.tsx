import { useMemo } from "react";
import { useKeybindContext } from "./KeybindProvider";
import type { KeybindDefinition } from "./types";

const zoneLabels = {
  "inbox-list": "Inbox list",
  "stuff-detail": "Stuff detail",
  "context-list": "Contexts list",
  "context-detail": "Context detail",
  "context-icon-editor": "Context icon editor"
};

function leaderTitle(leaderPath: string[]): string {
  return leaderPath.length > 0 ? `Space ${leaderPath.join(" ")}` : "Space";
}

function LeaderMenuHeader({ leaderPath }: { leaderPath: string[] }) {
  return (
    <div className="leader-menu__header">
      <span className="leader-menu__badge">Space</span>
      <span className="leader-menu__title">{leaderTitle(leaderPath)}</span>
    </div>
  );
}

function LeaderMenuItems({ bindings }: { bindings: KeybindDefinition[] }) {
  return (
    <div className="leader-menu__list" role="list">
      {bindings.map((binding) => (
        <div key={binding.id} className="leader-menu__item" role="listitem">
          <kbd>{binding.key}</kbd>
          <span>{binding.description}</span>
        </div>
      ))}
    </div>
  );
}

function LeaderMenuHint({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="leader-menu__hint" onClick={onClose}>
      Esc to close
    </button>
  );
}

/**
 * Shows the available keybindings for the active leader-key path.
 *
 * @example <LeaderMenu />
 */
export function LeaderMenu() {
  const { activeZone, closeLeaderMenu, getAvailableLeaderBindings, isLeaderMenuOpen, leaderPath } =
    useKeybindContext();

  const bindings = useMemo(() => getAvailableLeaderBindings(), [getAvailableLeaderBindings]);

  if (!isLeaderMenuOpen) {
    return null;
  }

  return (
    <div className="leader-menu" role="dialog" aria-label="Leader key menu">
      <LeaderMenuHeader leaderPath={leaderPath} />
      <div className="leader-menu__subtitle">{zoneLabels[activeZone]}</div>
      <LeaderMenuItems bindings={bindings} />
      <LeaderMenuHint onClose={closeLeaderMenu} />
    </div>
  );
}
