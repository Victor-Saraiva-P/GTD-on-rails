import { ItemBodyMarkdownEditor } from "./ItemBodyMarkdownEditor";
import { formatStuffCreatedAt, getStuffBodyPreviewLines, type Stuff } from "./types";

type InboxStuffDetailsProps = {
  item: Stuff;
  editing: boolean;
  onCommitEditing: (body: string) => Promise<void>;
  onExitEditingFromNormalMode: (body: string) => Promise<void>;
  onCancelEditing: () => void;
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
      <ItemBodyMarkdownEditor
        itemId={props.item.id}
        initialBody={props.item.body}
        onSave={props.onCommitEditing}
        onExitNormalMode={props.onExitEditingFromNormalMode}
      />
    </div>
  );
}

function formatBodyForDisplay(body: Stuff["body"]): string | null {
  if (!body) {
    return null;
  }

  return body;
}

function ReadOnlyInboxStuffDetails({ item }: Pick<InboxStuffDetailsProps, "item">) {
  const displayBody = formatBodyForDisplay(item.body);
  const previewLines = getStuffBodyPreviewLines(displayBody);

  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={item} />
      {displayBody ? (
        <div className="inbox-detail__body inbox-detail__body-preview" aria-label="Selected item details">
          {previewLines.map((line, index) => (
            <div className="inbox-detail__body-line" key={`${index}:${line}`}>
              <span className="inbox-detail__line-number">{index + 1}</span>
              <span className="inbox-detail__line-content">{line || "\u00A0"}</span>
            </div>
          ))}
        </div>
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
