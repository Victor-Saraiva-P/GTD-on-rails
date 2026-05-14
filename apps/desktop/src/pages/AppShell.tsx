import { useEffect, useMemo } from "react";
import { clearAssetObjectUrlCache } from "../features/inbox/assetFiles";
import { useDeletedInboxWorkspaceController } from "../features/inbox/useDeletedInboxWorkspaceController";
import { useInboxWorkspaceController, type InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { useActiveScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import {
  fetchDeletedNextActions,
  fetchDoneNextActions,
  recoverDeletedNextAction,
  restoreNextActionStatus
} from "../features/next-actions/api";
import {
  type ArchivedNextActionsConfig,
  useArchivedNextActionsWorkspaceController
} from "../features/next-actions/useArchivedNextActionsWorkspaceController";
import { useNextActionsWorkspaceController } from "../features/next-actions/useNextActionsWorkspaceController";
import { doneNextActionsListTheme, deletedNextActionsListTheme } from "../features/lists/listThemes";
import { ArchivedNextActionsPage } from "./ArchivedNextActionsPage";
import { ContextsPage } from "./ContextsPage";
import { DeletedInboxPage } from "./DeletedInboxPage";
import { InboxPage } from "./InboxPage";
import { NextActionDetailPage } from "./NextActionDetailPage";
import { NextActionsPage } from "./NextActionsPage";
import { OnGoingNextActionDetailPage } from "./OnGoingNextActionDetailPage";
import { OnGoingNextActionsPage } from "./OnGoingNextActionsPage";
import { StuffDetailPage } from "./StuffDetailPage";
import { useOnGoingNextActionsWorkspaceController } from "../features/next-actions/useOnGoingNextActionsWorkspaceController";

const doneNextActionsConfig = {
  detailZone: "done-next-action-detail",
  errorLabel: "completed next actions",
  listZone: "done-next-actions-list",
  loadItems: fetchDoneNextActions,
  recoverItem: restoreNextActionStatus
} satisfies ArchivedNextActionsConfig;

const deletedNextActionsConfig = {
  detailZone: "deleted-next-action-detail",
  errorLabel: "deleted next actions",
  listZone: "deleted-next-actions-list",
  loadItems: fetchDeletedNextActions,
  recoverItem: recoverDeletedNextAction
} satisfies ArchivedNextActionsConfig;

type AppControllers = ReturnType<typeof useAppControllers>;

function buildNavigationBindings(setActiveScreen: (screen: ScreenId) => void, inboxController: InboxWorkspaceController) {
  return [
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
      runKeybind: () => setActiveScreen("next-actions")
    },
    {
      id: "navigation.open-ongoing-next-actions",
      key: "o",
      description: "Open ongoing next actions",
      leader: true,
      sequence: ["o"],
      runKeybind: () => setActiveScreen("ongoing-next-actions")
    }
  ] satisfies KeybindDefinition[];
}

function useAppControllers() {
  return {
    deletedInbox: useDeletedInboxWorkspaceController(),
    deletedNextActions: useArchivedNextActionsWorkspaceController(deletedNextActionsConfig),
    doneNextActions: useArchivedNextActionsWorkspaceController(doneNextActionsConfig),
    inbox: useInboxWorkspaceController(),
    nextActions: useNextActionsWorkspaceController(),
    ongoingNextActions: useOnGoingNextActionsWorkspaceController()
  };
}

function useReloadActiveScreen(activeScreen: ScreenId, controllers: AppControllers) {
  useEffect(() => {
    if (activeScreen === "contexts") clearAssetObjectUrlCache();
    if (activeScreen === "inbox") controllers.inbox.reload();
    if (activeScreen === "deleted-inbox") controllers.deletedInbox.reload();
    if (activeScreen === "next-actions") controllers.nextActions.reload();
    if (activeScreen === "ongoing-next-actions") controllers.ongoingNextActions.reload();
    if (activeScreen === "ongoing-next-action-detail-page") controllers.ongoingNextActions.reload();
    if (activeScreen === "done-next-actions") controllers.doneNextActions.reload();
    if (activeScreen === "deleted-next-actions") controllers.deletedNextActions.reload();
  }, [activeScreen]);
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

function renderActiveScreen(activeScreen: ScreenId, controllers: AppControllers) {
  if (activeScreen === "contexts") return <ContextsPage />;
  if (activeScreen === "stuff-detail") return <StuffDetailPage controller={controllers.inbox} />;
  if (activeScreen === "deleted-inbox") return <DeletedInboxPage controller={controllers.deletedInbox} />;
  if (activeScreen === "next-actions") return <NextActionsPage controller={controllers.nextActions} selectOnGoingAction={controllers.ongoingNextActions.setSelectedId} />;
  if (activeScreen === "ongoing-next-actions") return <OnGoingNextActionsPage controller={controllers.ongoingNextActions} selectNextAction={controllers.nextActions.setSelectedId} />;
  if (activeScreen === "next-action-detail-page") return <NextActionDetailPage controller={controllers.nextActions} />;
  if (activeScreen === "ongoing-next-action-detail-page") return <OnGoingNextActionDetailPage controller={controllers.ongoingNextActions} selectNextAction={controllers.nextActions.setSelectedId} />;
  if (activeScreen === "done-next-actions") return renderDoneNextActionsPage(controllers);
  if (activeScreen === "deleted-next-actions") return renderDeletedNextActionsPage(controllers);

  return <InboxPage controller={controllers.inbox} />;
}

/**
 * Selects the active desktop page and wires shared navigation keybindings.
 *
 * @example <AppShell />
 */
export function AppShell() {
  const { activeScreen, setActiveScreen } = useActiveScreen();
  const controllers = useAppControllers();
  const navigationBindings = useMemo(() => buildNavigationBindings(setActiveScreen, controllers.inbox), [setActiveScreen, controllers.inbox]);

  useReloadActiveScreen(activeScreen, controllers);
  useRegisterKeybinds(navigationBindings);
  return renderActiveScreen(activeScreen, controllers);
}
