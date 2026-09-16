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
  somedayMaybe?: NavigableController;
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
  if (activeScreen === "someday-maybe") {
    return { screen: "someday-maybe", zone: "someday-maybe-list", selectedItemId: controllers.somedayMaybe?.selectedItem?.id ?? null };
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

interface JumpTarget {
  setSelectedId?: (id: string | null) => void;
  setActiveZone?: (zone: FocusZoneId) => void;
  zone: FocusZoneId;
}

function resolveJumpTarget(screen: ScreenId, controllers: JumpControllers): JumpTarget | null {
  if (screen === "inbox") return { setSelectedId: controllers.inbox.setSelectedId, setActiveZone: controllers.inbox.setActiveZone, zone: "inbox-list" };
  if (screen === "next-actions") return { setSelectedId: controllers.nextActions.setSelectedId, setActiveZone: controllers.nextActions.setActiveZone, zone: "next-actions-list" };
  if (screen === "calendars") return { setSelectedId: controllers.calendars.setSelectedId, setActiveZone: controllers.calendars.setActiveZone, zone: "calendar-today-due-panel" };
  if (screen === "ongoing-next-actions") return { setSelectedId: controllers.ongoing.setSelectedId, setActiveZone: controllers.ongoing.setActiveZone, zone: "next-actions-list" };
  if (screen === "projects") return { setSelectedId: controllers.projects.setSelectedId, setActiveZone: controllers.projects.setActiveZone, zone: "projects-list" };
  if (screen === "someday-maybe") {
    return { setSelectedId: controllers.somedayMaybe?.setSelectedId, setActiveZone: controllers.somedayMaybe?.setActiveZone, zone: "someday-maybe-list" };
  }
  return null;
}

function applyScreenJump(entry: JumpEntry, controllers: JumpControllers): void {
  const target = resolveJumpTarget(entry.screen, controllers);
  if (!target) return;
  if (entry.selectedItemId) target.setSelectedId?.(entry.selectedItemId);
  target.setActiveZone?.(target.zone);
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
