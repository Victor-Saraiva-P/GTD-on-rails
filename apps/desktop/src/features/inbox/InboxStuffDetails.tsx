import { useEffect, useRef } from "react";
import { getStuffBodyLines, type Stuff } from "./types";

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
      <div className="detail-card">
        <textarea
          ref={textareaRef}
          value={editingBody}
          className="detail-card__textarea"
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

  const details = getStuffBodyLines(item.body);

  if (details.length === 0) {
    return <p className="pane-state">No details yet for this stuff.</p>;
  }

  return (
    <div className="detail-card">
      <ul className="detail-list" aria-label="Selected item details">
        {details.map((detail) => (
          <li key={detail} className="detail-list__item">
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
