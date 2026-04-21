import { useState } from "react";
import { Pane } from "../components/Pane";
import { InboxList } from "../features/inbox/InboxList";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { inboxStuffs } from "../features/inbox/mock-inbox-stuffs";

export function InboxPage() {
  const [selectedId, setSelectedId] = useState<string>(inboxStuffs[0].id);
  const selectedItem = inboxStuffs.find((item) => item.id === selectedId) ?? inboxStuffs[0];
  const selectedPosition = inboxStuffs.findIndex((item) => item.id === selectedItem.id) + 1;

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
        >
          <InboxList items={inboxStuffs} selectedId={selectedItem.id} onSelect={setSelectedId} />
        </Pane>

        <Pane
          iconSrc="/inbox/stuff icon.png"
          label={selectedItem.title}
          bodyClassName="pane__body--detail"
          wrapLabel
        >
          <InboxStuffDetails item={selectedItem} />
        </Pane>
      </section>
    </main>
  );
}
