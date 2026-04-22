import { useEffect, useMemo, useState } from "react";
import { Pane } from "../components/Pane";
import { InboxList } from "../features/inbox/InboxList";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import type { KeybindDefinition } from "../features/keybinds/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveZone, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { useInboxStuffsQuery } from "../features/inbox/useInboxStuffsQuery";

export function InboxPage() {
  useKeybindScreen("inbox");

  const { stuffs, isLoading, errorMessage, reload } = useInboxStuffsQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { activeZone, setActiveZone } = useActiveZone();
  const selectedItem =
    stuffs.find((item) => item.id === selectedId) ?? (stuffs.length > 0 ? stuffs[0] : null);
  const selectedPosition = selectedItem
    ? stuffs.findIndex((item) => item.id === selectedItem.id) + 1
    : 0;
  const selectedIndex = selectedPosition - 1;

  useEffect(() => {
    if (stuffs.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !stuffs.some((item) => item.id === selectedId)) {
      setSelectedId(stuffs[0].id);
    }
  }, [selectedId, stuffs]);

  const selectNextStuff = () => {
    if (stuffs.length === 0) {
      return;
    }

    const nextIndex = Math.min(selectedIndex + 1, stuffs.length - 1);
    setSelectedId(stuffs[nextIndex].id);
  };

  const selectPreviousStuff = () => {
    if (stuffs.length === 0) {
      return;
    }

    const previousIndex = Math.max(selectedIndex - 1, 0);
    setSelectedId(stuffs[previousIndex].id);
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
        handler: () => {
          if (stuffs.length === 0) {
            return;
          }

          setActiveZone("stuff-detail");
        }
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
    [selectedIndex, setActiveZone, stuffs.length]
  );

  useRegisterKeybinds(bindings);

  const listBody = (() => {
    if (isLoading) {
      return <p className="pane-state">Loading inbox...</p>;
    }

    if (errorMessage) {
      return (
        <div className="pane-state">
          <p>{errorMessage}</p>
          <button type="button" className="pane-state__action" onClick={reload}>
            Retry
          </button>
        </div>
      );
    }

    if (stuffs.length === 0) {
      return <p className="pane-state">Inbox is empty.</p>;
    }

    return <InboxList items={stuffs} selectedId={selectedItem?.id ?? ""} onSelect={setSelectedId} />;
  })();

  const detailBody = (() => {
    if (isLoading) {
      return <p className="pane-state">Loading stuff details...</p>;
    }

    if (errorMessage) {
      return <p className="pane-state">Stuff details are unavailable while inbox loading fails.</p>;
    }

    if (!selectedItem) {
      return <p className="pane-state">Select a stuff to inspect its details.</p>;
    }

    return <InboxStuffDetails item={selectedItem} />;
  })();

  return (
    <main className="workspace">
      <section className="inbox-layout" aria-label="Inbox">
        <Pane
          iconSrc="/inbox/inbox icon.png"
          label="Inbox"
          status={
            <>
              <span>({selectedPosition})</span>
              <span>{stuffs.length}/{stuffs.length}</span>
            </>
          }
          active={activeZone === "inbox-list"}
        >
          {listBody}
        </Pane>

        <Pane
          iconSrc="/inbox/stuff icon.png"
          label={selectedItem?.title ?? "Stuff"}
          bodyClassName="pane__body--detail"
          wrapLabel={selectedItem !== null}
          active={activeZone === "stuff-detail"}
        >
          {detailBody}
        </Pane>
      </section>
      <LeaderMenu />
    </main>
  );
}
