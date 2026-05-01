import { useMemo } from "react";
import { useInboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { useActiveScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";
import { ContextsPage } from "./ContextsPage";
import { InboxPage } from "./InboxPage";
import { StuffDetailPage } from "./StuffDetailPage";

function buildNavigationBindings(setActiveScreen: (screen: "contexts" | "inbox" | "stuff-detail") => void) {
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
      runKeybind: () => setActiveScreen("inbox")
    }
  ] satisfies KeybindDefinition[];
}

export function AppShell() {
  const { activeScreen, setActiveScreen } = useActiveScreen();
  const inboxController = useInboxWorkspaceController();
  const navigationBindings = useMemo(() => buildNavigationBindings(setActiveScreen), [setActiveScreen]);

  useRegisterKeybinds(navigationBindings);

  if (activeScreen === "contexts") {
    return <ContextsPage />;
  }

  if (activeScreen === "stuff-detail") {
    return <StuffDetailPage controller={inboxController} />;
  }

  return <InboxPage controller={inboxController} />;
}
