import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { formatStuffCreatedAt, type Stuff } from "./types";

type InboxStuffDetailsProps = {
  item: Stuff;
  editing: boolean;
  editingBody: string;
  onEditingBodyChange: (value: string) => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
};

function useFocusEditingTextarea(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  editing: boolean
) {
  useEffect(() => {
    if (!editing || !textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    const caretPosition = textarea.value.length;

    textarea.focus();
    textarea.setSelectionRange(caretPosition, caretPosition);
  }, [editing, textareaRef]);
}

function handleTextareaKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  onCommitEditing: () => void
) {
  if (event.key === "Escape" || ((event.metaKey || event.ctrlKey) && event.key === "Enter")) {
    event.preventDefault();
    onCommitEditing();
  }
}

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

type EditingInboxStuffDetailsProps = Omit<InboxStuffDetailsProps, "editing" | "onCancelEditing"> & {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

function EditingInboxStuffDetails(props: EditingInboxStuffDetailsProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    handleTextareaKeyDown(event, props.onCommitEditing);
  };

  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={props.item} />
      <InboxDetailTextarea
        value={props.editingBody}
        textareaRef={props.textareaRef}
        onChange={props.onEditingBodyChange}
        onBlur={props.onCommitEditing}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

type InboxDetailTextareaProps = {
  value: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

function InboxDetailTextarea(props: InboxDetailTextareaProps) {
  return (
    <textarea
      ref={props.textareaRef}
      value={props.value}
      className="inbox-detail__textarea"
      onChange={(event) => props.onChange(event.target.value)}
      onBlur={props.onBlur}
      onKeyDown={props.onKeyDown}
    />
  );
}

function ReadOnlyInboxStuffDetails({ item }: Pick<InboxStuffDetailsProps, "item">) {
  return (
    <div className="inbox-detail">
      <InboxDetailHeader item={item} />
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

/**
 * Renders selected stuff details with optional body editing controls.
 *
 * @example <InboxStuffDetails item={stuff} editing={false} ... />
 */
export function InboxStuffDetails(props: InboxStuffDetailsProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useFocusEditingTextarea(textareaRef, props.editing);

  if (props.editing) {
    return <EditingInboxStuffDetails {...props} textareaRef={textareaRef} />;
  }

  return <ReadOnlyInboxStuffDetails item={props.item} />;
}
