import { useEffect, useMemo } from "react";
import { clearAssetObjectUrlCache } from "../features/inbox/assetFiles";
import { useInboxWorkspaceController, type InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { useActiveScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";
import { ContextsPage } from "./ContextsPage";
import { InboxPage } from "./InboxPage";
import { StuffDetailPage } from "./StuffDetailPage";

function buildNavigationBindings(setActiveScreen: (screen: "contexts" | "inbox" | "stuff-detail") => void, inboxController: InboxWorkspaceController) {
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
  const navigationBindings = useMemo(() => buildNavigationBindings(setActiveScreen, inboxController), [setActiveScreen, inboxController]);

  useEffect(() => {
    if (activeScreen === "contexts") clearAssetObjectUrlCache();
  }, [activeScreen]);

  useRegisterKeybinds(navigationBindings);

  if (activeScreen === "contexts") {
    return <ContextsPage />;
  }

  if (activeScreen === "stuff-detail") {
    return <StuffDetailPage controller={inboxController} />;
  }

  return <InboxPage controller={inboxController} />;
}
