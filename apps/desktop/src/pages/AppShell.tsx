import { useMemo } from "react";
import { useActiveScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";
import { ContextsPage } from "./ContextsPage";
import { InboxPage } from "./InboxPage";

export function AppShell() {
  const { activeScreen, setActiveScreen } = useActiveScreen();

  const navigationBindings = useMemo<KeybindDefinition[]>(
    () => [
      {
        id: "navigation.open-contexts",
        key: "C",
        description: "Open contexts",
        leader: true,
        sequence: ["C"],
        handler: () => setActiveScreen("contexts")
      },
      {
        id: "navigation.open-inbox",
        key: "i",
        description: "Open inbox",
        leader: true,
        sequence: ["i"],
        handler: () => setActiveScreen("inbox")
      }
    ],
    [setActiveScreen]
  );

  useRegisterKeybinds(navigationBindings);

  if (activeScreen === "contexts") {
    return <ContextsPage />;
  }

  return <InboxPage />;
}
