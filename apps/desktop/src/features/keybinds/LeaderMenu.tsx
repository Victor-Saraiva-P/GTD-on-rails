import { useMemo } from "react";
import { useKeybindContext } from "./KeybindProvider";
import type { FocusZoneId, KeybindDefinition } from "./types";

const zoneLabels: Record<FocusZoneId, string> = {
  "inbox-list": "Inbox list",
  "stuff-detail": "Stuff detail",
  "deleted-inbox-list": "Deleted stuff list",
  "deleted-stuff-detail": "Deleted stuff detail",
  "calendar-today-due-panel": "Due calendar panel",
  "calendar-today-done-panel": "Completed today calendar panel",
  "calendar-detail": "Calendar detail",
  "calendar-completed-panel": "Completed calendar panel",
  "calendar-deleted-panel": "Deleted calendar panel",
  "calendar-mon-panel": "Monday calendar panel",
  "calendar-tue-panel": "Tuesday calendar panel",
  "calendar-wed-panel": "Wednesday calendar panel",
  "calendar-thu-panel": "Thursday calendar panel",
  "calendar-fri-panel": "Friday calendar panel",
  "calendar-sat-panel": "Saturday calendar panel",
  "calendar-sun-panel": "Sunday calendar panel",
  "next-actions-list": "Next actions list",
  "next-action-detail": "Next action detail",
  "ongoing-calendars-list": "On going calendars list",
  "done-next-actions-list": "Completed next actions list",
  "done-next-action-detail": "Completed next action detail",
  "deleted-next-actions-list": "Deleted next actions list",
  "deleted-next-action-detail": "Deleted next action detail",
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
