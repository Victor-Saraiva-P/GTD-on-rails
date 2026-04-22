import { useEffect, useRef } from "react";
import { formatStuffCreatedAt, type Stuff } from "./types";

type InboxStuffDetailsProps = {
  item: Stuff;
  editing: boolean;
  editingBody: string;
  onEditingBodyChange: (value: string) => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
};

export function InboxStuffDetails({
  item,
  editing,
  editingBody,
  onEditingBodyChange,
  onCommitEditing,
  onCancelEditing
}: InboxStuffDetailsProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) {
      return;
    }

    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const caretPosition = textarea.value.length;

    textarea.focus();
    textarea.setSelectionRange(caretPosition, caretPosition);
  }, [editing]);

  if (editing) {
    return (
      <div className="inbox-detail">
        <p className="inbox-detail__meta">Created: {formatStuffCreatedAt(item.createdAt)}</p>
        <h1 className="inbox-detail__title">{item.title}</h1>
        <div className="inbox-detail__divider" />
        <textarea
          ref={textareaRef}
          value={editingBody}
          className="inbox-detail__textarea"
          onChange={(event) => onEditingBodyChange(event.target.value)}
          onBlur={onCommitEditing}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCommitEditing();
            }

            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onCommitEditing();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="inbox-detail">
      <p className="inbox-detail__meta">Created: {formatStuffCreatedAt(item.createdAt)}</p>
      <h1 className="inbox-detail__title">{item.title}</h1>
      <div className="inbox-detail__divider" />
      {item.body ? (
        <pre className="inbox-detail__body" aria-label="Selected item details">
          {item.body}
        </pre>
      ) : (
        <p className="pane-state">No details yet for this stuff.</p>
      )}
    </div>
  );
}
