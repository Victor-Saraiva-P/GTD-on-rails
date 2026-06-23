import type { RecurringCalendarTemplate } from "./types";
import { recurringTemplateRecurrenceLabel } from "./recurringCalendarTemplateDisplay";

type RecurringCalendarTemplateListProps = Readonly<{
  templates: RecurringCalendarTemplate[];
}>;

/**
 * Renders Recurring Calendar Templates without occurrence-only actions.
 *
 * @example <RecurringCalendarTemplateList templates={templates} />
 */
export function RecurringCalendarTemplateList({ templates }: RecurringCalendarTemplateListProps) {
  return (
    <ol className="tree-list tree-list--inbox" aria-label="Recurring Calendar Templates">
      {templates.map((template) => <RecurringCalendarTemplateCard key={template.id} template={template} />)}
    </ol>
  );
}

function RecurringCalendarTemplateCard({ template }: Readonly<{ template: RecurringCalendarTemplate }>) {
  return (
    <li className="tree-list__item">
      <div className="tree-entry calendar-item-entry">
        <span className="tree-entry__glyph tree-entry__glyph--stuff tree-entry__glyph--calendar-active" aria-hidden="true">R</span>
        <span className="tree-entry__label">{template.title}</span>
        <span className="calendar-entry__time">{recurringTemplateRecurrenceLabel(template)}</span>
      </div>
    </li>
  );
}
