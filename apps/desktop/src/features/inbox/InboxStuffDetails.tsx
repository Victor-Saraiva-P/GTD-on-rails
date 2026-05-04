import { ItemBodyMarkdownEditor } from "./ItemBodyMarkdownEditor";
import { formatStuffCreatedAt, getStuffBodyPreviewLines, type Stuff } from "./types";

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

type EditingInboxStuffDetailsProps = Omit<InboxStuffDetailsProps, "editing" | "onCancelEditing">;

function EditingInboxStuffDetails(props: EditingInboxStuffDetailsProps) {
  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={props.item} />
      <ItemBodyMarkdownEditor
        itemId={props.item.id}
        initialBody={props.item.body}
        onAutosave={props.onAutosaveEditing}
        onSave={props.onCommitEditing}
        onExitNormalMode={props.onExitEditingFromNormalMode}
        onVimModeChange={props.onVimModeChange}
      />
    </div>
  );
}

/** Returns {level, mark, content} for ATX headings H1-H4, or null. */
function parseHeadingLine(line: string): { level: number; mark: string; content: string } | null {
  const match = line.match(/^(#{1,3}) (.*)/);
  if (!match) return null;
  return { level: match[1].length, mark: match[1] + " ", content: match[2] };
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
          {previewLines.map((line, index) => {
            const heading = parseHeadingLine(line);
            if (heading) {
              const cls = `cm-md-heading-${heading.level}`;
              return (
                <div className="inbox-detail__body-line" key={`${index}:${line}`}>
                  <span className="inbox-detail__line-number">{index + 1}</span>
                  <span className={`inbox-detail__line-content ${cls}`}>
                    {heading.content}
                  </span>
                </div>
              );
            }
            const bulletMatch = line.match(/^(\s*)([-*+]\s+)(.*)/);
            if (bulletMatch) {
              const [_, indent, bullet, content] = bulletMatch;
              const level = Math.floor(indent.length / 2) % 3;
              return (
                <div className="inbox-detail__body-line" key={`${index}:${line}`}>
                  <span className="inbox-detail__line-number">{index + 1}</span>
                  <span className="inbox-detail__line-content">
                    {indent}<span className={`cm-bullet-mark cm-bullet-level-${level}`}>{bullet}</span>{content}
                  </span>
                </div>
              );
            }
            const numberedMatch = line.match(/^(\s*)(\d+\.\s+)(.*)/);
            if (numberedMatch) {
              const [_, indent, number, content] = numberedMatch;
              return (
                <div className="inbox-detail__body-line" key={`${index}:${line}`}>
                  <span className="inbox-detail__line-number">{index + 1}</span>
                  <span className="inbox-detail__line-content">{indent}{number}{content}</span>
                </div>
              );
            }
            return (
              <div className="inbox-detail__body-line" key={`${index}:${line}`}>
                <span className="inbox-detail__line-number">{index + 1}</span>
                <span className="inbox-detail__line-content">{line || "\u00A0"}</span>
              </div>
            );
          })}
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
