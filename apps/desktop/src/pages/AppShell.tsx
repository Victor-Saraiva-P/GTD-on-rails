import { useEffect, useMemo, useState } from "react";
import { clearAssetObjectUrlCache } from "../features/inbox/assetFiles";
import { evictBackendCache } from "../lib/api/cache.ts";
import { useCalendarWorkspaceController, type CalendarWorkspaceController } from "../features/calendar/useCalendarWorkspaceController";
import { useDeletedInboxWorkspaceController } from "../features/inbox/useDeletedInboxWorkspaceController";
import { useInboxWorkspaceController, type InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { useActiveScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import {
  deleteNextAction,
  fetchDeletedNextActions,
  fetchDoneNextActions,
  recoverDeletedNextAction,
  resetNextActionStatus
} from "../features/next-actions/api";
import {
  type ArchivedNextActionsConfig,
  useArchivedNextActionsWorkspaceController
} from "../features/next-actions/useArchivedNextActionsWorkspaceController";
import { useNextActionsWorkspaceController } from "../features/next-actions/useNextActionsWorkspaceController";
import { doneNextActionsListTheme, deletedNextActionsListTheme } from "../features/lists/listThemes";
import { ArchivedNextActionsPage } from "./ArchivedNextActionsPage";
import { CalendarDetailPage } from "./CalendarDetailPage";
import { OnGoingCalendarDetailPage } from "./OnGoingCalendarDetailPage";
import { CalendarPage } from "./CalendarPage";
import { ContextsPage } from "./ContextsPage";
import { DeletedInboxPage } from "./DeletedInboxPage";
import { InboxPage } from "./InboxPage";
import { NextActionDetailPage } from "./NextActionDetailPage";
import { NextActionsPage } from "./NextActionsPage";
import { OnGoingNextActionDetailPage } from "./OnGoingNextActionDetailPage";
import { OnGoingNextActionsPage } from "./OnGoingNextActionsPage";
import { ProjectsPage } from "./ProjectsPage";
import { ProjectDetailPage } from "./ProjectDetailPage";
import { StuffDetailPage } from "./StuffDetailPage";
import { useGoogleCalendarIntegrationController } from "../features/integrations/useGoogleCalendarIntegrationController";
import { GoogleCalendarIntegrationPage } from "./GoogleCalendarIntegrationPage";
import type { NextActionsWorkspaceController } from "../features/next-actions/useNextActionsWorkspaceController";
import { useOnGoingWorkspaceController } from "../features/ongoing/useOnGoingWorkspaceController";
import type { OnGoingWorkspaceController } from "../features/ongoing/useOnGoingWorkspaceController";
import { useProjectsWorkspaceController } from "../features/projects/useProjectsWorkspaceController";
import type { ProjectsWorkspaceController } from "../features/projects/useProjectsWorkspaceController";
import { useProjectDetailController } from "../features/projects/useProjectDetailController";
import type { Project } from "../features/projects/types";

const doneNextActionsConfig = {
  detailZone: "done-next-action-detail",
  errorLabel: "completed next actions",
  listZone: "done-next-actions-list",
  deleteItem: deleteNextAction,
  loadItems: fetchDoneNextActions,
  recoverItem: resetNextActionStatus
} satisfies ArchivedNextActionsConfig;

const deletedNextActionsConfig = {
  detailZone: "deleted-next-action-detail",
  errorLabel: "deleted next actions",
  listZone: "deleted-next-actions-list",
  loadItems: fetchDeletedNextActions,
  recoverItem: recoverDeletedNextAction
} satisfies ArchivedNextActionsConfig;

type AppControllers = ReturnType<typeof useAppControllers>;

function openNextActionsWorkspace(controller: NextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  controller.resetWorkspace();
  setActiveScreen("next-actions");
}

function openOnGoingWorkspace(
  controller: OnGoingWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void
) {
  controller.resetWorkspace();
  controller.setActiveZone("next-actions-list");
  setActiveScreen("ongoing-next-actions");
}

function openProjectsWorkspace(
  controller: ProjectsWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void
) {
  controller.resetWorkspace();
  setActiveScreen("projects");
}

function buildNavigationBindings(
  setActiveScreen: (screen: ScreenId) => void,
  inboxController: InboxWorkspaceController,
  calendarController: CalendarWorkspaceController,
  nextActionsController: NextActionsWorkspaceController,
  onGoingController: OnGoingWorkspaceController,
  projectsController: ProjectsWorkspaceController
) {
  return [
    {
      id: "navigation.open-calendars",
      key: "c",
      description: "Open calendars",
      leader: true,
      sequence: ["c"],
      runKeybind: () => {
        calendarController.resetWorkspace();
        setActiveScreen("calendars");
      }
    },
    {
      id: "navigation.open-contexts",
      key: "C",
      description: "Open contexts",
      leader: true,
      sequence: ["C"],
      runKeybind: () => setActiveScreen("contexts")
    },
    {
      id: "navigation.open-inbox",
      key: "i",
      description: "Open inbox",
      leader: true,
      sequence: ["i"],
      runKeybind: () => {
        inboxController.resetWorkspace();
        setActiveScreen("inbox");
      }
    },
    {
      id: "navigation.open-next-actions",
      key: "n",
      description: "Open next actions",
      leader: true,
      sequence: ["n"],
      runKeybind: () => openNextActionsWorkspace(nextActionsController, setActiveScreen)
    },
    {
      id: "navigation.open-ongoing-next-actions",
      key: "o",
      description: "Open ongoing work",
      leader: true,
      sequence: ["o"],
      runKeybind: () => openOnGoingWorkspace(onGoingController, setActiveScreen)
    },
    {
      id: "navigation.open-projects",
      key: "p",
      description: "Open projects",
      leader: true,
      sequence: ["p"],
      runKeybind: () => openProjectsWorkspace(projectsController, setActiveScreen)
    },
    {
      id: "navigation.open-google-calendar-integration",
      key: "g",
      description: "Google Calendar Integration",
      leader: true,
      sequence: ["I", "g"],
      runKeybind: () => setActiveScreen("google-calendar-integration")
    }
  ] satisfies KeybindDefinition[];
}

function useAppControllers(projectDetailProject: Project | null) {
  return {
    calendars: useCalendarWorkspaceController(),
    deletedInbox: useDeletedInboxWorkspaceController(),
    deletedNextActions: useArchivedNextActionsWorkspaceController(deletedNextActionsConfig),
    doneNextActions: useArchivedNextActionsWorkspaceController(doneNextActionsConfig),
    inbox: useInboxWorkspaceController(),
    nextActions: useNextActionsWorkspaceController(),
    ongoing: useOnGoingWorkspaceController(),
    projectDetail: useProjectDetailController(projectDetailProject),
    projects: useProjectsWorkspaceController(),
    googleCalendarIntegration: useGoogleCalendarIntegrationController()
  };
}

function reloadActiveController(activeScreen: ScreenId, controllers: AppControllers): void {
  if (activeScreen === "contexts") clearAssetObjectUrlCache();
  if (activeScreen === "inbox") controllers.inbox.reload();
  if (activeScreen === "deleted-inbox") controllers.deletedInbox.reload();
  if (activeScreen === "calendars" || activeScreen === "calendar-detail-page") controllers.calendars.reload();
  if (activeScreen === "next-actions") controllers.nextActions.reload();
  if (activeScreen === "projects") controllers.projects.reload();
  if (activeScreen === "project-detail") controllers.projectDetail.reload();
  if (
    activeScreen === "ongoing-next-actions" ||
    activeScreen === "ongoing-next-action-detail-page" ||
    activeScreen === "ongoing-calendar-detail-page"
  ) controllers.ongoing.reload();
  if (activeScreen === "done-next-actions") controllers.doneNextActions.reload();
  if (activeScreen === "deleted-next-actions") controllers.deletedNextActions.reload();
  if (activeScreen === "google-calendar-integration") controllers.googleCalendarIntegration.reload();
}

function useReloadActiveScreen(activeScreen: ScreenId, controllers: AppControllers) {
  useEffect(() => {
    reloadActiveController(activeScreen, controllers);
  }, [activeScreen]);

  useEffect(() => {
    const handleFocus = () => {
      void evictBackendCache().then(() => reloadActiveController(activeScreen, controllers));
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [activeScreen, controllers]);
}

function useAgentStateBridge(activeScreen: ScreenId) {
  useEffect(() => {
    if (!agentStateBridgeEnabled()) return;
    window.__GTD_AGENT_STATE__ = {
      route: window.location.pathname,
      activeView: activeScreen,
      focusedPanel: activeScreen,
      modalOpen: document.querySelector('dialog, [role="dialog"]') !== null
    };
    return () => {
      delete window.__GTD_AGENT_STATE__;
    };
  }, [activeScreen]);
}

function agentStateBridgeEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_GTD_AGENT_STATE === "true";
}

function renderDoneNextActionsPage(controllers: AppControllers) {
  return (
    <ArchivedNextActionsPage
      controller={controllers.doneNextActions}
      detailTitle="Next Action Detail"
      emptyMessage="No completed next actions yet."
      label="Completed Next Actions"
      listTitle="Completed Next Actions"
      screen="done-next-actions"
      listZone="done-next-actions-list"
      detailZone="done-next-action-detail"
      previousScreen="next-actions"
      nextScreen="deleted-next-actions"
      theme={doneNextActionsListTheme}
    />
  );
}

function renderDeletedNextActionsPage(controllers: AppControllers) {
  return (
    <ArchivedNextActionsPage
      controller={controllers.deletedNextActions}
      detailTitle="Next Action Detail"
      emptyMessage="No deleted next actions yet."
      label="Deleted Next Actions"
      listTitle="Deleted Next Actions"
      screen="deleted-next-actions"
      listZone="deleted-next-actions-list"
      detailZone="deleted-next-action-detail"
      previousScreen="done-next-actions"
      nextScreen="next-actions"
      theme={deletedNextActionsListTheme}
    />
  );
}

function openProjectsAfterProcessing(controllers: AppControllers, setActiveScreen: (screen: ScreenId) => void) {
  controllers.projects.reload();
  controllers.projects.resetWorkspace();
  setActiveScreen("projects");
}

function renderActiveScreen(activeScreen: ScreenId, controllers: AppControllers, setActiveScreen: (screen: ScreenId) => void, openProjectDetail: () => void) {
  if (activeScreen === "contexts") return <ContextsPage />;
  if (activeScreen === "calendars") return <CalendarPage controller={controllers.calendars} selectOnGoingCalendar={controllers.ongoing.setSelectedId} />;
  if (activeScreen === "calendar-detail-page") return <CalendarDetailPage controller={controllers.calendars} />;
  if (activeScreen === "stuff-detail") return <StuffDetailPage controller={controllers.inbox} />;
  if (activeScreen === "projects") return <ProjectsPage controller={controllers.projects} openProjectDetail={openProjectDetail} />;
  if (activeScreen === "project-detail") return <ProjectDetailPage controller={controllers.projectDetail} />;
  if (activeScreen === "deleted-inbox") return <DeletedInboxPage controller={controllers.deletedInbox} />;
  if (activeScreen === "next-actions") return <NextActionsPage controller={controllers.nextActions} selectOnGoingAction={controllers.ongoing.setSelectedId} />;
  if (activeScreen === "ongoing-next-actions") return <OnGoingNextActionsPage controller={controllers.ongoing} selectNextAction={controllers.nextActions.setSelectedId} />;
  if (activeScreen === "next-action-detail-page") return <NextActionDetailPage controller={controllers.nextActions} />;
  if (activeScreen === "ongoing-next-action-detail-page") return <OnGoingNextActionDetailPage controller={controllers.ongoing} />;
  if (activeScreen === "ongoing-calendar-detail-page") return <OnGoingCalendarDetailPage controller={controllers.ongoing} />;
  if (activeScreen === "done-next-actions") return renderDoneNextActionsPage(controllers);
  if (activeScreen === "deleted-next-actions") return renderDeletedNextActionsPage(controllers);
  if (activeScreen === "google-calendar-integration") return <GoogleCalendarIntegrationPage controller={controllers.googleCalendarIntegration} />;

  return <InboxPage controller={controllers.inbox} openProjects={() => openProjectsAfterProcessing(controllers, setActiveScreen)} />;
}

/**
 * Selects the active desktop page and wires shared navigation keybindings.
 *
 * @example <AppShell />
 */
export function AppShell() {
  const { activeScreen, setActiveScreen } = useActiveScreen();
  const [projectDetailProject, setProjectDetailProject] = useState<Project | null>(null);
  const controllers = useAppControllers(projectDetailProject);
  const openProjectDetail = useMemo(() => () => {
    setProjectDetailProject(controllers.projects.selectedItem ?? null);
    setActiveScreen("project-detail");
  }, [controllers.projects.selectedItem, setActiveScreen]);
  const navigationBindings = useMemo(
    () => buildNavigationBindings(setActiveScreen, controllers.inbox, controllers.calendars, controllers.nextActions, controllers.ongoing, controllers.projects),
    [setActiveScreen, controllers.inbox, controllers.calendars, controllers.nextActions, controllers.ongoing, controllers.projects]
  );

  useReloadActiveScreen(activeScreen, controllers);
  useAgentStateBridge(activeScreen);
  useRegisterKeybinds(navigationBindings);
  return renderActiveScreen(activeScreen, controllers, setActiveScreen, openProjectDetail);
}
