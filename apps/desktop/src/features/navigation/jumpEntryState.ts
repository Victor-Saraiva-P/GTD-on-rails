import type { FocusZoneId, ScreenId } from "../keybinds/types";
import type { Project } from "../projects/types";
import type { JumpEntry } from "./jumpList";

export type NavigableController = {
  selectedItem?: { id: string } | null;
  setSelectedId: (id: string | null) => void;
  setActiveZone?: (zone: FocusZoneId) => void;
};

export type OnGoingNavigableController = {
  selectedItem?: { item: { id: string } } | null;
  setSelectedId: (id: string | null) => void;
  setActiveZone?: (zone: FocusZoneId) => void;
};

export type JumpControllers = {
  inbox: NavigableController;
  nextActions: NavigableController;
  calendars: NavigableController;
  ongoing: OnGoingNavigableController;
  projects: NavigableController & { projects: Project[] };
  projectDetail: NavigableController;
};

function getSpecificJumpEntry(activeScreen: ScreenId, controllers: JumpControllers): JumpEntry | null {
  if (activeScreen === "inbox") {
    return { screen: "inbox", zone: "inbox-list", selectedItemId: controllers.inbox.selectedItem?.id ?? null };
  }
  if (activeScreen === "next-actions") {
    return { screen: "next-actions", zone: "next-actions-list", selectedItemId: controllers.nextActions.selectedItem?.id ?? null };
  }
  if (activeScreen === "calendars") {
    return { screen: "calendars", zone: "calendar-today-due-panel", selectedItemId: controllers.calendars.selectedItem?.id ?? null };
  }
  if (activeScreen === "ongoing-next-actions") {
    return { screen: "ongoing-next-actions", zone: "next-actions-list", selectedItemId: controllers.ongoing.selectedItem?.item.id ?? null };
  }
  if (activeScreen === "projects") {
    return { screen: "projects", zone: "projects-list", selectedItemId: controllers.projects.selectedItem?.id ?? null };
  }
  return null;
}

/**
 * Captures the current jump entry representing the active user location.
 *
 * @example getCurrentJumpEntry(activeScreen, controllers, project)
 */
export function getCurrentJumpEntry(
  activeScreen: ScreenId,
  controllers: JumpControllers,
  project: Project | null
): JumpEntry {
  if (activeScreen === "project-detail") {
    return {
      screen: "project-detail",
      zone: "project-actions-list",
      projectId: project?.id ?? null,
      projectTitle: project?.title ?? null,
      selectedItemId: controllers.projectDetail.selectedItem?.id ?? null
    };
  }
  return getSpecificJumpEntry(activeScreen, controllers) ?? { screen: activeScreen };
}

function applyProjectJump(
  entry: JumpEntry,
  controllers: JumpControllers,
  setProjectDetailProject: (project: Project | null) => void
): void {
  const existing = controllers.projects.projects.find((p) => p.id === entry.projectId) ?? null;
  const project: Project = existing ?? { id: entry.projectId ?? "", title: entry.projectTitle ?? "Project" };
  setProjectDetailProject(project);
  if (entry.projectId) controllers.projects.setSelectedId(entry.projectId);
  if (entry.selectedItemId) controllers.projectDetail.setSelectedId(entry.selectedItemId);
  controllers.projectDetail.setActiveZone?.("project-actions-list");
}

function applyScreenJump(entry: JumpEntry, controllers: JumpControllers): void {
  if (entry.screen === "inbox") {
    if (entry.selectedItemId) controllers.inbox.setSelectedId(entry.selectedItemId);
    controllers.inbox.setActiveZone?.("inbox-list");
  } else if (entry.screen === "next-actions") {
    if (entry.selectedItemId) controllers.nextActions.setSelectedId(entry.selectedItemId);
    controllers.nextActions.setActiveZone?.("next-actions-list");
  } else if (entry.screen === "calendars") {
    if (entry.selectedItemId) controllers.calendars.setSelectedId(entry.selectedItemId);
    controllers.calendars.setActiveZone?.("calendar-today-due-panel");
  } else if (entry.screen === "ongoing-next-actions") {
    if (entry.selectedItemId) controllers.ongoing.setSelectedId(entry.selectedItemId);
    controllers.ongoing.setActiveZone?.("next-actions-list");
  } else if (entry.screen === "projects") {
    if (entry.selectedItemId) controllers.projects.setSelectedId(entry.selectedItemId);
    controllers.projects.setActiveZone?.("projects-list");
  }
}

/**
 * Applies a jump entry by restoring the target screen, project, and selection.
 *
 * @example applyJumpEntry(entry, controllers, setActiveScreen, setProjectDetailProject)
 */
export function applyJumpEntry(
  entry: JumpEntry,
  controllers: JumpControllers,
  setActiveScreen: (screen: ScreenId) => void,
  setProjectDetailProject: (project: Project | null) => void
): void {
  setActiveScreen(entry.screen);
  if (entry.screen === "project-detail") {
    applyProjectJump(entry, controllers, setProjectDetailProject);
    return;
  }
  applyScreenJump(entry, controllers);
}
