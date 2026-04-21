import { useMemo, useState } from "react";
import { Pane } from "../components/Pane";
import { InboxList } from "../features/inbox/InboxList";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import type { KeybindDefinition } from "../features/keybinds/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveZone, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { inboxStuffs } from "../features/inbox/mock-inbox-stuffs";

export function InboxPage() {
  useKeybindScreen("inbox");

  const [selectedId, setSelectedId] = useState<string>(inboxStuffs[0].id);
  const { activeZone, setActiveZone } = useActiveZone();
  const selectedItem = inboxStuffs.find((item) => item.id === selectedId) ?? inboxStuffs[0];
  const selectedPosition = inboxStuffs.findIndex((item) => item.id === selectedItem.id) + 1;
  const selectedIndex = selectedPosition - 1;

  const selectNextStuff = () => {
    const nextIndex = Math.min(selectedIndex + 1, inboxStuffs.length - 1);
    setSelectedId(inboxStuffs[nextIndex].id);
  };

  const selectPreviousStuff = () => {
    const previousIndex = Math.max(selectedIndex - 1, 0);
    setSelectedId(inboxStuffs[previousIndex].id);
  };

  const bindings = useMemo<KeybindDefinition[]>(
    () => [
      {
        id: "inbox.move-down",
        key: "j",
        description: "Move down",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: selectNextStuff
      },
      {
        id: "inbox.move-up",
        key: "k",
        description: "Move up",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: selectPreviousStuff
      },
      {
        id: "inbox.focus-detail",
        key: "l",
        description: "Focus stuff detail",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => setActiveZone("stuff-detail")
      },
      {
        id: "inbox.focus-list",
        key: "h",
        description: "Focus inbox list",
        screen: "inbox" as const,
        zone: "stuff-detail" as const,
        handler: () => setActiveZone("inbox-list")
      },
      {
        id: "inbox.which-key-list",
        key: "k",
        description: "Show available keybinds",
        leader: true,
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => undefined
      },
      {
        id: "inbox.which-key-detail",
        key: "k",
        description: "Show available keybinds",
        leader: true,
        screen: "inbox" as const,
        zone: "stuff-detail" as const,
        handler: () => undefined
      }
    ],
    [selectedIndex, setActiveZone]
  );

  useRegisterKeybinds(bindings);

  return (
    <main className="workspace">
      <section className="inbox-layout" aria-label="Inbox">
        <Pane
          iconSrc="/inbox/inbox icon.png"
          label="Inbox"
          status={
            <>
              <span>({selectedPosition})</span>
              <span>{inboxStuffs.length}/{inboxStuffs.length}</span>
            </>
          }
          active={activeZone === "inbox-list"}
        >
          <InboxList items={inboxStuffs} selectedId={selectedItem.id} onSelect={setSelectedId} />
        </Pane>

        <Pane
          iconSrc="/inbox/stuff icon.png"
          label={selectedItem.title}
          bodyClassName="pane__body--detail"
          wrapLabel
          active={activeZone === "stuff-detail"}
        >
          <InboxStuffDetails item={selectedItem} />
        </Pane>
      </section>
      <LeaderMenu />
    </main>
  );
}
