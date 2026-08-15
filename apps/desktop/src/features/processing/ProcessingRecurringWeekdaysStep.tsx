import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

const WEEKDAYS = [
  { id: "MONDAY", label: "Monday" },
  { id: "TUESDAY", label: "Tuesday" },
  { id: "WEDNESDAY", label: "Wednesday" },
  { id: "THURSDAY", label: "Thursday" },
  { id: "FRIDAY", label: "Friday" },
  { id: "SATURDAY", label: "Saturday" },
  { id: "SUNDAY", label: "Sunday" }
] as const;

type ProcessingRecurringWeekdaysStepProps = Readonly<{
  defaultWeekday: string;
  initialSelectedWeekdays?: string[];
  onBack: () => void;
  onSelectedWeekdaysChange?: (weekdays: string[]) => void;
  onWeekdaysSelected: (weekdays: string[]) => void;
}>;

function nextWeekdayIndex(currentIndex: number, offset: number): number {
  return Math.min(Math.max(currentIndex + offset, 0), WEEKDAYS.length - 1);
}

function toggleWeekday(selected: string[], day: string): string[] {
  return selected.includes(day)
    ? selected.filter((selectedDay) => selectedDay !== day)
    : [...selected, day];
}

function weekdayItemClassName(isFocused: boolean, isSelected: boolean): string {
  const classNames = ["processing-dialog__list-item"];
  if (isFocused) classNames.push("processing-dialog__list-item--focused");
  if (isSelected) classNames.push("processing-dialog__list-item--checked");
  return classNames.join(" ");
}

/**
 * Captures weekly recurrence days of the week with keyboard navigation.
 *
 * @example <ProcessingRecurringWeekdaysStep defaultWeekday="MONDAY" onWeekdaysSelected={save} onBack={back} />
 */
export function ProcessingRecurringWeekdaysStep({
  defaultWeekday,
  initialSelectedWeekdays,
  onBack,
  onSelectedWeekdaysChange,
  onWeekdaysSelected
}: ProcessingRecurringWeekdaysStepProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialSelection = initialSelectedWeekdays && initialSelectedWeekdays.length > 0
    ? initialSelectedWeekdays
    : [defaultWeekday];
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>(initialSelection);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const toggleFocusedDay = () => {
    const day = WEEKDAYS[focusedIndex].id;
    const nextSelection = toggleWeekday(selectedWeekdays, day);
    setSelectedWeekdays(nextSelection);
    onSelectedWeekdaysChange?.(nextSelection);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return onBack();
    if (event.key === "j" || event.key === "ArrowDown") return setFocusedIndex((i) => nextWeekdayIndex(i, 1));
    if (event.key === "k" || event.key === "ArrowUp") return setFocusedIndex((i) => nextWeekdayIndex(i, -1));
    if (event.key === "Tab" || event.key === " ") return toggleFocusedDay();
    if (event.key === "Enter") {
      const result = selectedWeekdays.length > 0 ? selectedWeekdays : [defaultWeekday];
      return onWeekdaysSelected(result);
    }
  };

  return (
    <div ref={containerRef} className="processing-dialog__step processing-dialog__step--weekdays" tabIndex={-1} onKeyDown={handleKeyDown}>
      <div className="processing-dialog__label">Weekdays:</div>
      <ol className="tree-list processing-dialog__list" aria-label="Weekdays">
        {WEEKDAYS.map((weekday, index) => {
          const isFocused = index === focusedIndex;
          const isSelected = selectedWeekdays.includes(weekday.id);
          return (
            <li key={weekday.id} className="tree-list__item">
              <button
                type="button"
                className={weekdayItemClassName(isFocused, isSelected)}
                onClick={() => {
                  setFocusedIndex(index);
                  const next = toggleWeekday(selectedWeekdays, weekday.id);
                  setSelectedWeekdays(next);
                  onSelectedWeekdaysChange?.(next);
                }}
              >
                <span className="tree-entry__checkbox" aria-hidden="true">
                  {isSelected ? "☑" : "☐"}
                </span>
                <span className="tree-entry__label">{weekday.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="processing-dialog__hint">Press Tab or Space to toggle, Enter to confirm.</div>
    </div>
  );
}
