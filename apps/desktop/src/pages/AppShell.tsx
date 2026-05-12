import { useEffect, useMemo } from "react";
import { clearAssetObjectUrlCache } from "../features/inbox/assetFiles";
import { useDeletedInboxWorkspaceController } from "../features/inbox/useDeletedInboxWorkspaceController";
import { useInboxWorkspaceController, type InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { useActiveScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";
import { useNextActionsWorkspaceController } from "../features/next-actions/useNextActionsWorkspaceController";
import { ContextsPage } from "./ContextsPage";
import { DeletedInboxPage } from "./DeletedInboxPage";
import { InboxPage } from "./InboxPage";
import { NextActionsPage } from "./NextActionsPage";
import { StuffDetailPage } from "./StuffDetailPage";

function buildNavigationBindings(setActiveScreen: (screen: "contexts" | "deleted-inbox" | "inbox" | "next-actions" | "stuff-detail") => void, inboxController: InboxWorkspaceController) {
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
    }
  ] satisfies KeybindDefinition[];
}

/**
 * Selects the active desktop page and wires shared navigation keybindings.
 *
 * @example <AppShell />
 */
export function AppShell() {
  const { activeScreen, setActiveScreen } = useActiveScreen();
  const inboxController = useInboxWorkspaceController();
  const deletedInboxController = useDeletedInboxWorkspaceController();
  const nextActionsController = useNextActionsWorkspaceController();
  const navigationBindings = useMemo(() => buildNavigationBindings(setActiveScreen, inboxController), [setActiveScreen, inboxController]);

  useEffect(() => {
    if (activeScreen === "contexts") {
      clearAssetObjectUrlCache();
    }
    if (activeScreen === "inbox") {
      inboxController.reload();
    }
    if (activeScreen === "deleted-inbox") {
      deletedInboxController.reload();
    }
    if (activeScreen === "next-actions") {
      nextActionsController.reload();
    }
  }, [activeScreen]);

  useRegisterKeybinds(navigationBindings);

  if (activeScreen === "contexts") {
    return <ContextsPage />;
  }

  if (activeScreen === "stuff-detail") {
    return <StuffDetailPage controller={inboxController} />;
  }

  if (activeScreen === "deleted-inbox") {
    return <DeletedInboxPage controller={deletedInboxController} />;
  }

  if (activeScreen === "next-actions") {
    return <NextActionsPage controller={nextActionsController} />;
  }

  return <InboxPage controller={inboxController} />;
}
