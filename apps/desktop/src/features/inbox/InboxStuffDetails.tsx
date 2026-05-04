import { StuffBodyEditor } from "./StuffBodyEditor";
import type { StuffBodyVimMode } from "./stuffBodyVim";
import { formatStuffCreatedAt, type Stuff } from "./types";

type InboxStuffDetailsProps = {
  item: Stuff;
  editing: boolean;
  editingBody: string;
  onEditingBodyChange: (value: string) => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
  onModeChange?: (mode: StuffBodyVimMode | null) => void;
  writeClipboardText?: (value: string) => void;
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

type EditingInboxStuffDetailsProps = Omit<InboxStuffDetailsProps, "editing" | "onCancelEditing">;

function EditingInboxStuffDetails(props: EditingInboxStuffDetailsProps) {
  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={props.item} />
      <StuffBodyEditor
        value={props.editingBody}
        onChange={props.onEditingBodyChange}
        onBlur={props.onCommitEditing}
        onCommitEditing={props.onCommitEditing}
        onModeChange={props.onModeChange}
        writeClipboardText={props.writeClipboardText}
      />
    </div>
  );
}

function formatBodyForDisplay(body: Stuff["body"]): string | null {
  if (!body || !body.blocks) {
    return null;
  }

  return body.blocks
    .filter((block) => block.type === "paragraph")
    .map((block) => block.properties.richText.map((run) => run.text).join(""))
    .join("\n\n");
}

function ReadOnlyInboxStuffDetails({ item }: Pick<InboxStuffDetailsProps, "item">) {
  const displayBody = formatBodyForDisplay(item.body);

  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={item} />
      {displayBody ? (
        <pre className="inbox-detail__body" aria-label="Selected item details">
          {displayBody}
        </pre>
      ) : (
        <p className="pane-state">No details yet for this stuff.</p>
      )}
    </div>
  );
}

/**
 * Renders selected stuff details with optional body editing controls.
 *
 * @example <InboxStuffDetails item={stuff} editing={false} ... />
 */
export function InboxStuffDetails(props: InboxStuffDetailsProps) {
  if (props.editing) {
    return <EditingInboxStuffDetails {...props} />;
  }

  return <ReadOnlyInboxStuffDetails item={props.item} />;
}
