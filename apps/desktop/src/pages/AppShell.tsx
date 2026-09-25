import { useCallback, useEffect, useMemo, useState } from "react";
import { clearAssetObjectUrlCache } from "../features/inbox/assetFiles";
import { useCalendarWorkspaceController } from "../features/calendar/useCalendarWorkspaceController";
import { useDeletedInboxWorkspaceController } from "../features/inbox/useDeletedInboxWorkspaceController";
import { useInboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { useActiveScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { HintOverlay } from "../features/keybinds/HintOverlay.tsx";
import { WhichKeyDialog } from "../features/keybinds/WhichKeyDialog";
import { useZoomMode } from "../features/zoom-mode/ZoomModeContext";
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
import { useOnGoingWorkspaceController } from "../features/ongoing/useOnGoingWorkspaceController";
import { useProjectsWorkspaceController } from "../features/projects/useProjectsWorkspaceController";
import { useProjectDetailController } from "../features/projects/useProjectDetailController";
import type { Project } from "../features/projects/types";
import { useJumpListNavigation } from "../features/navigation/useJumpListNavigation";
import type { ProjectItem } from "../features/projects/projectItems";
import { useSomedayMaybeWorkspaceController } from "../features/someday-maybe/useSomedayMaybeWorkspaceController";
import { SomedayMaybePage } from "./SomedayMaybePage";

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

function buildScreenJumpBindings(
  jumpToScreen: (screen: ScreenId, beforeNavigate?: () => void) => void,
  controllers: AppControllers
): KeybindDefinition[] {
  return [
    { id: "navigation.open-calendars", key: "c", description: "Open calendars", leader: true, sequence: ["c"], runKeybind: () => jumpToScreen("calendars", controllers.calendars.resetWorkspace) },
    { id: "navigation.open-contexts", key: "C", description: "Open contexts", leader: true, sequence: ["C"], runKeybind: () => jumpToScreen("contexts") },
    { id: "navigation.open-inbox", key: "i", description: "Open inbox", leader: true, sequence: ["i"], runKeybind: () => jumpToScreen("inbox", controllers.inbox.resetWorkspace) },
    { id: "navigation.open-next-actions", key: "n", description: "Open next actions", leader: true, sequence: ["n"], runKeybind: () => jumpToScreen("next-actions", controllers.nextActions.resetWorkspace) },
    { id: "navigation.open-ongoing-next-actions", key: "o", description: "Open ongoing work", leader: true, sequence: ["o"], runKeybind: () => jumpToScreen("ongoing-next-actions", () => { controllers.ongoing.resetWorkspace(); controllers.ongoing.setActiveZone("next-actions-list"); }) },
    { id: "navigation.open-projects", key: "p", description: "Open projects", leader: true, sequence: ["p"], runKeybind: () => jumpToScreen("projects", controllers.projects.resetWorkspace) },
    { id: "navigation.open-someday-maybe", key: "s", description: "Open someday/maybe", leader: true, sequence: ["s"], runKeybind: () => jumpToScreen("someday-maybe", controllers.somedayMaybe.resetWorkspace) },
    { id: "navigation.open-google-calendar-integration", key: "g", description: "Google Calendar Integration", leader: true, sequence: ["I", "g"], runKeybind: () => jumpToScreen("google-calendar-integration") }
  ];
}

function buildNavigationBindings(
  jumpToScreen: (screen: ScreenId, beforeNavigate?: () => void) => void,
  goBack: () => void,
  goForward: () => void,
  controllers: AppControllers,
  openHintMode: () => void,
  toggleZoomMode: () => void
): KeybindDefinition[] {
  return [
    { id: "navigation.jump-back", key: "o", ctrl: true, description: "Jump to older position", runKeybind: goBack },
    { id: "navigation.jump-forward", key: "i", ctrl: true, description: "Jump to newer position", runKeybind: goForward },
    ...buildScreenJumpBindings(jumpToScreen, controllers),
    { id: "navigation.open-hint-mode", key: "h", description: "Hint mode (jump to UI element)", leader: true, sequence: ["h"], runKeybind: openHintMode },
    { id: "navigation.toggle-zoom-mode", key: "z", description: "Toggle Zoom Mode", leader: true, sequence: ["z"], runKeybind: toggleZoomMode }
  ];
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
    googleCalendarIntegration: useGoogleCalendarIntegrationController(),
    somedayMaybe: useSomedayMaybeWorkspaceController()
  };
}

function revalidateActiveScreen(activeScreen: ScreenId, controllers: AppControllers): void {
  if (activeScreen === "inbox") return controllers.inbox.reload();
  if (activeScreen === "deleted-inbox") return controllers.deletedInbox.reload();
  if (activeScreen === "calendars" || activeScreen === "calendar-detail-page") return controllers.calendars.reload();
  if (activeScreen === "next-actions") return controllers.nextActions.reload();
  if (activeScreen === "projects") return controllers.projects.reload();
  if (activeScreen === "project-detail") return controllers.projectDetail.reload();
  if (activeScreen.startsWith("ongoing-")) return controllers.ongoing.reload();
  if (activeScreen === "done-next-actions") return controllers.doneNextActions.reload();
  if (activeScreen === "deleted-next-actions") return controllers.deletedNextActions.reload();
  if (activeScreen === "someday-maybe") return controllers.somedayMaybe.reload();
}

function useScreenLocalEffects(activeScreen: ScreenId, controllers: AppControllers) {
  useEffect(() => {
    if (activeScreen === "contexts") clearAssetObjectUrlCache();
    revalidateActiveScreen(activeScreen, controllers);
  }, [activeScreen]);
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

function renderDetailScreens(activeScreen: ScreenId, controllers: AppControllers) {
  if (activeScreen === "calendar-detail-page") return <CalendarDetailPage controller={controllers.calendars} />;
  if (activeScreen === "stuff-detail") return <StuffDetailPage controller={controllers.inbox} />;
  if (activeScreen === "next-action-detail-page") return <NextActionDetailPage controller={controllers.nextActions} />;
  if (activeScreen === "ongoing-next-action-detail-page") return <OnGoingNextActionDetailPage controller={controllers.ongoing} />;
  if (activeScreen === "ongoing-calendar-detail-page") return <OnGoingCalendarDetailPage controller={controllers.ongoing} />;
  return null;
}

function renderActiveScreen(
  activeScreen: ScreenId,
  controllers: AppControllers,
  setActiveScreen: (screen: ScreenId) => void,
  openProjectDetail: () => void,
  openOwnerProject: (projectId: string, projectTitle?: string | null, targetItemId?: string | null) => void,
  openProjectItemDestination: (item: ProjectItem) => void
) {
  const detail = renderDetailScreens(activeScreen, controllers);
  if (detail) return detail;
  if (activeScreen === "contexts") return <ContextsPage />;
  if (activeScreen === "calendars") return <CalendarPage controller={controllers.calendars} selectOnGoingCalendar={controllers.ongoing.setSelectedId} openOwnerProject={openOwnerProject} projects={controllers.projects.projects} />;
  if (activeScreen === "projects") return <ProjectsPage controller={controllers.projects} openProjectDetail={openProjectDetail} />;
  if (activeScreen === "project-detail") return <ProjectDetailPage controller={controllers.projectDetail} openItemDestination={openProjectItemDestination} openOwnerProject={openOwnerProject} projects={controllers.projects.projects} />;
  if (activeScreen === "deleted-inbox") return <DeletedInboxPage controller={controllers.deletedInbox} />;
  if (activeScreen === "next-actions") return <NextActionsPage controller={controllers.nextActions} selectOnGoingAction={controllers.ongoing.setSelectedId} openOwnerProject={openOwnerProject} projects={controllers.projects.projects} />;
  if (activeScreen === "ongoing-next-actions") return <OnGoingNextActionsPage controller={controllers.ongoing} selectNextAction={controllers.nextActions.setSelectedId} openOwnerProject={openOwnerProject} projects={controllers.projects.projects} />;
  if (activeScreen === "done-next-actions") return renderDoneNextActionsPage(controllers);
  if (activeScreen === "deleted-next-actions") return renderDeletedNextActionsPage(controllers);
  if (activeScreen === "google-calendar-integration") return <GoogleCalendarIntegrationPage controller={controllers.googleCalendarIntegration} />;
  if (activeScreen === "someday-maybe") return <SomedayMaybePage controller={controllers.somedayMaybe} openOwnerProject={openOwnerProject} projects={controllers.projects.projects} />;

  return <InboxPage controller={controllers.inbox} openProjects={() => openProjectsAfterProcessing(controllers, setActiveScreen)} openOwnerProject={openOwnerProject} projects={controllers.projects.projects} />;
}

/**
 * Selects the active desktop page and wires shared navigation keybindings.
 *
 * @example <AppShell />
 */
function useOpenProjectDetail(
  controllers: AppControllers,
  navigation: ReturnType<typeof useJumpListNavigation>
) {
  return useCallback(() => {
    const selected = controllers.projects.selectedItem;
    if (!selected) return;
    const project = controllers.projects.projects.find((p) => p.id === selected.id);
    navigation.openOwnerProject(selected.id, project?.title ?? null, null);
  }, [controllers.projects.projects, controllers.projects.selectedItem, navigation]);
}

function useAppShellBindings(
  navigation: ReturnType<typeof useJumpListNavigation>,
  controllers: AppControllers,
  openHintMode: () => void,
  toggleZoomMode: () => void
) {
  return useMemo(
    () => buildNavigationBindings(navigation.jumpToScreen, navigation.goBack, navigation.goForward, controllers, openHintMode, toggleZoomMode),
    [navigation.jumpToScreen, navigation.goBack, navigation.goForward, controllers, openHintMode, toggleZoomMode]
  );
}

function useHintModeState() {
  const [isHintModeActive, setIsHintModeActive] = useState(false);
  const openHintMode = useCallback(() => setIsHintModeActive(true), []);
  const closeHintMode = useCallback(() => setIsHintModeActive(false), []);
  return { isHintModeActive, openHintMode, closeHintMode };
}

/**
 * Selects the active desktop page and wires shared navigation keybindings.
 *
 * @example <AppShell />
 */
export function AppShell() {
  const { activeScreen, setActiveScreen } = useActiveScreen();
  const [projectDetailProject, setProjectDetailProject] = useState<Project | null>(null);
  const { isHintModeActive, openHintMode, closeHintMode } = useHintModeState();
  const { toggleZoomMode } = useZoomMode();
  const controllers = useAppControllers(projectDetailProject);
  const navigation = useJumpListNavigation({
    activeScreen, setActiveScreen, controllers, projectDetailProject, setProjectDetailProject
  });
  const openProjectDetail = useOpenProjectDetail(controllers, navigation);
  const navigationBindings = useAppShellBindings(navigation, controllers, openHintMode, toggleZoomMode);

  useScreenLocalEffects(activeScreen, controllers);
  useAgentStateBridge(activeScreen);
  useRegisterKeybinds(navigationBindings);
  return (
    <>
      {renderActiveScreen(activeScreen, controllers, setActiveScreen, openProjectDetail, navigation.openOwnerProject, navigation.openProjectItemDestination)}
      {isHintModeActive && <HintOverlay onExit={closeHintMode} />}
      <WhichKeyDialog />
    </>
  );
}
