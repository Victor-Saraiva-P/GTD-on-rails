import { ItemBodyMarkdownEditor } from "./ItemBodyMarkdownEditor";
import { formatStuffCreatedAt, type Stuff } from "./types";

type InboxStuffDetailsProps = {
  item: Stuff;
  editing: boolean;
  onAutosaveEditing: (body: string) => Promise<void>;
  onCommitEditing: (body: string) => Promise<void>;
  onExitEditingFromNormalMode: (body: string) => Promise<void>;
  onCancelEditing: () => void;
  onVimModeChange?: (mode: "NORMAL" | "INSERT" | "VISUAL") => void;
};

function InboxDetailHeader({ item }: Pick<InboxStuffDetailsProps, "item">) {
  const createdAtLabel = `created: ${formatStuffCreatedAt(item.createdAt).toLowerCase()}`;

  return (
    <>
      <h1 className="inbox-detail__title">{item.title}</h1>
      <p className="inbox-detail__meta">{createdAtLabel}</p>
      <div className="inbox-detail__divider" />
    </>
  );
}

/**
 * Renders selected stuff details with unified Vim-enabled text display.
 *
 * @example <InboxStuffDetails item={stuff} editing={false} ... />
 */
export function InboxStuffDetails(props: InboxStuffDetailsProps) {
  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={props.item} />
      <ItemBodyMarkdownEditor
        itemId={props.item.id}
        initialBody={props.item.body}
        readOnly={!props.editing}
        onAutosave={props.onAutosaveEditing}
        onSave={props.onCommitEditing}
        onExitNormalMode={props.onExitEditingFromNormalMode}
        onVimModeChange={props.onVimModeChange}
      />
    </div>
  );
}

