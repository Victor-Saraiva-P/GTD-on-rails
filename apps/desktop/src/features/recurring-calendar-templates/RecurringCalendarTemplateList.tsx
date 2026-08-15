import type { KeyboardEvent } from "react";
import { InlineTitleInput } from "../../components/InlineTitleInput";
import type { RecurringCalendarTemplate } from "./types";
import { recurringTemplateRecurrenceLabel } from "./recurringCalendarTemplateDisplay";

type RecurringCalendarTemplateListProps = Readonly<{
  editingId?: string | null;
  editingTitle?: string;
  editingTitleError?: string | null;
  onCancelEditing?: () => void;
  onCommitEditing?: () => void;
  onCommitEditingAndContinue?: () => void;
  onEditingTitleChange?: (value: string) => void;
  onSelect: (id: string) => void;
  onStartEditing?: () => void;
  selectedId: string;
  templates: RecurringCalendarTemplate[];
}>;

type RecurringCalendarTemplateCardProps = Readonly<{
  editing: boolean;
  editingTitle?: string;
  editingTitleError?: string | null;
  onCancelEditing?: () => void;
  onCommitEditing?: () => void;
  onCommitEditingAndContinue?: () => void;
  onEditingTitleChange?: (value: string) => void;
  onSelect: (id: string) => void;
  onStartEditing?: () => void;
  selected: boolean;
  template: RecurringCalendarTemplate;
}>;

/**
 * Renders Recurring Calendar Templates with keyboard navigation and inline title editing.
 *
 * @example <RecurringCalendarTemplateList templates={templates} selectedId="template-1" onSelect={setSelectedId} />
 */
export function RecurringCalendarTemplateList({
  editingId,
  editingTitle = "",
  editingTitleError = null,
  onCancelEditing,
  onCommitEditing,
  onCommitEditingAndContinue,
  onEditingTitleChange,
  onSelect,
  onStartEditing,
  selectedId,
  templates
}: RecurringCalendarTemplateListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Recurring Calendar Templates">
      {templates.map((template) => (
        <RecurringCalendarTemplateCard
          key={template.id}
          editing={template.id === editingId}
          editingTitle={editingTitle}
          editingTitleError={editingTitleError}
          onCancelEditing={onCancelEditing}
          onCommitEditing={onCommitEditing}
          onCommitEditingAndContinue={onCommitEditingAndContinue}
          onEditingTitleChange={onEditingTitleChange}
          onSelect={onSelect}
          onStartEditing={onStartEditing}
          selected={template.id === selectedId}
          template={template}
        />
      ))}
    </ol>
  );
}

function handleEditKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onCommit?: () => void
) {
  if (event.key === "Enter" || event.key === "Escape") {
    event.preventDefault();
    onCommit?.();
  }
}

function RecurringCalendarTemplateCard(props: RecurringCalendarTemplateCardProps) {
  if (props.editing) {
    return (
      <li className="tree-list__item">
        <div className="tree-entry tree-entry--active calendar-item-entry">
          <span className="tree-entry__glyph tree-entry__glyph--stuff tree-entry__glyph--calendar-active" aria-hidden="true">R</span>
          <div className="tree-entry__edit">
            <InlineTitleInput
              initialValue={props.editingTitle || props.template.title}
              onBlur={() => props.onCommitEditing?.()}
              onEditKeyDown={(event) => handleEditKeyDown(event, props.onCommitEditingAndContinue)}
              onValueChange={(val) => props.onEditingTitleChange?.(val)}
            />
            {props.editingTitleError ? <p className="tree-entry__error">{props.editingTitleError}</p> : null}
          </div>
          <span className="calendar-entry__time">{recurringTemplateRecurrenceLabel(props.template)}</span>
        </div>
      </li>
    );
  }

  return (
    <li className="tree-list__item">
      <button
        type="button"
        className={`tree-entry calendar-item-entry${props.selected ? " tree-entry--active" : ""}`}
        onClick={() => props.onSelect(props.template.id)}
        onDoubleClick={() => {
          props.onSelect(props.template.id);
          if (props.selected) props.onStartEditing?.();
        }}
      >
        <span className="tree-entry__glyph tree-entry__glyph--stuff tree-entry__glyph--calendar-active" aria-hidden="true">R</span>
        <span className="tree-entry__label">{props.template.title}</span>
        <span className="calendar-entry__time">{recurringTemplateRecurrenceLabel(props.template)}</span>
      </button>
    </li>
  );
}
