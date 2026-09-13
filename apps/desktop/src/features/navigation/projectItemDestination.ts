import type { ProjectItem } from "../projects/projectItems";
import type { JumpEntry } from "./jumpList";

/**
 * Resolves the destination jump entry for a project item.
 *
 * @example resolveProjectItemDestination(projectItem)
 */
export function resolveProjectItemDestination(item: ProjectItem | null | undefined): JumpEntry | null {
  if (!item || item.id === "__draft_project_item__") return null;
  if (item.kind === "NEXT_ACTION") {
    return { screen: "next-actions", zone: "next-actions-list", selectedItemId: item.id };
  }
  if (item.kind === "CALENDAR") {
    return { screen: "calendars", zone: "calendar-today-due-panel", selectedItemId: item.id };
  }
  if (item.kind === "STUFF") {
    return { screen: "inbox", zone: "inbox-list", selectedItemId: item.id };
  }
  return null;
}
