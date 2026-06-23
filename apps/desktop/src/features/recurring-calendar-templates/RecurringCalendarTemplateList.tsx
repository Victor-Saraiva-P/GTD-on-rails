import type { RecurringCalendarTemplate } from "./types";
import { recurringTemplateRecurrenceLabel } from "./recurringCalendarTemplateDisplay";

type RecurringCalendarTemplateListProps = Readonly<{
  onSelect: (id: string) => void;
  selectedId: string;
  templates: RecurringCalendarTemplate[];
}>;

/**
 * Renders Recurring Calendar Templates without occurrence-only actions.
 *
 * @example <RecurringCalendarTemplateList templates={templates} selectedId="template-1" onSelect={setSelectedId} />
 */
export function RecurringCalendarTemplateList({ onSelect, selectedId, templates }: RecurringCalendarTemplateListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Recurring Calendar Templates">
      {templates.map((template) => (
        <RecurringCalendarTemplateCard
          key={template.id}
          onSelect={onSelect}
          selected={template.id === selectedId}
          template={template}
        />
      ))}
    </ol>
  );
}

function RecurringCalendarTemplateCard(props: Readonly<{
  onSelect: (id: string) => void;
  selected: boolean;
  template: RecurringCalendarTemplate;
}>) {
  return (
    <li className="tree-list__item">
      <button
        type="button"
        className={`tree-entry calendar-item-entry${props.selected ? " tree-entry--active" : ""}`}
        onClick={() => props.onSelect(props.template.id)}
      >
        <span className="tree-entry__glyph tree-entry__glyph--stuff tree-entry__glyph--calendar-active" aria-hidden="true">R</span>
        <span className="tree-entry__label">{props.template.title}</span>
        <span className="calendar-entry__time">{recurringTemplateRecurrenceLabel(props.template)}</span>
      </button>
    </li>
  );
}
