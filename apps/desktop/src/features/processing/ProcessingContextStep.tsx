import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useContextsQuery } from "../contexts/useContextsQuery";
import type { ContextItem } from "../contexts/types";

type ProcessingContextStepProps = {
  onContextsSelected: (contextIds: string[]) => void;
  onCancel: () => void;
  initialSelectedIds?: string[];
};

function nextFocusedIndex(currentIndex: number, offset: number, contexts: ContextItem[]): number {
  if (contexts.length === 0) return 0;
  return Math.min(Math.max(currentIndex + offset, 0), contexts.length - 1);
}

function toggleContextId(selectedIds: string[], contextId: string): string[] {
  return selectedIds.includes(contextId)
    ? selectedIds.filter((selectedId) => selectedId !== contextId)
    : [...selectedIds, contextId];
}

function contextItemClassName(isFocused: boolean, isSelected: boolean): string {
  const classNames = ["processing-dialog__list-item"];
  if (isFocused) classNames.push("processing-dialog__list-item--focused");
  if (isSelected) classNames.push("processing-dialog__list-item--checked");
  return classNames.join(" ");
}

function syncSelectedIds(setSelectedIds: (updater: (currentIds: string[]) => string[]) => void, selectedIdsRef: MutableRefObject<string[]>, contextId: string) {
  setSelectedIds((currentIds) => {
    const nextIds = toggleContextId(currentIds, contextId);
    selectedIdsRef.current = nextIds;
    return nextIds;
  });
}

/**
 * Selects zero or more contexts for a next action during inbox processing.
 *
 * @example <ProcessingContextStep onContextsSelected={saveIds} onCancel={close} />
 */
export function ProcessingContextStep({ onContextsSelected, onCancel, initialSelectedIds = [] }: ProcessingContextStepProps) {
  const { contexts, isLoading } = useContextsQuery();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextsRef = useRef<ContextItem[]>([]);
  const focusedIndexRef = useRef(0);
  const handleKeyDownRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  const selectedIdsRef = useRef<string[]>(initialSelectedIds);

  useEffect(() => {
    const focusId = window.setTimeout(() => containerRef.current?.focus(), 0);
    return () => window.clearTimeout(focusId);
  }, []);

  useEffect(() => {
    setFocusedIndex((currentIndex) => {
      const nextIndex = nextFocusedIndex(currentIndex, 0, contexts);
      focusedIndexRef.current = nextIndex;
      return nextIndex;
    });
    contextsRef.current = contexts;
  }, [contexts]);

  const toggleFocusedContext = () => {
    const focusedContext = contextsRef.current[focusedIndexRef.current];
    if (!focusedContext) return;
    syncSelectedIds(setSelectedIds, selectedIdsRef, focusedContext.id);
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDownRef.current(event);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);

  handleKeyDownRef.current = (event: KeyboardEvent) => {
    const handledKeys = ["Escape", "Tab", "Enter", "j", "k"];
    if (!handledKeys.includes(event.key)) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") onCancel();
    if (event.key === "j") moveFocusedContext(1);
    if (event.key === "k") moveFocusedContext(-1);
    if (event.key === "Tab") toggleFocusedContext();
    if (event.key === "Enter") onContextsSelected(selectedIdsRef.current);
  };

  const moveFocusedContext = (offset: number) => {
    const nextIndex = nextFocusedIndex(focusedIndexRef.current, offset, contextsRef.current);
    focusedIndexRef.current = nextIndex;
    setFocusedIndex(nextIndex);
  };

  return (
    <div ref={containerRef} className="processing-dialog__step processing-dialog__step--context" tabIndex={-1}>
      <div className="processing-dialog__label">Contexts</div>
      <div className="processing-dialog__list" role="listbox" aria-label="Contexts" aria-multiselectable="true">
        {isLoading ? (
          <div className="processing-dialog__list-item processing-dialog__list-item--muted">Loading...</div>
        ) : contexts.length === 0 ? (
          <div className="processing-dialog__list-item processing-dialog__list-item--muted">No contexts. Press Enter for anywhere.</div>
        ) : (
          contexts.map((context, index) => {
            const isSelected = selectedIds.includes(context.id);
            return (
              <button
                key={context.id}
                type="button"
                tabIndex={-1}
                className={contextItemClassName(index === focusedIndex, isSelected)}
                aria-selected={isSelected}
                onClick={() => syncSelectedIds(setSelectedIds, selectedIdsRef, context.id)}
                onMouseEnter={() => {
                  focusedIndexRef.current = index;
                  setFocusedIndex(index);
                }}
              >
                <span className="processing-dialog__check" aria-hidden="true">{isSelected ? "[x]" : "[ ]"}</span>
                <span>{context.name}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="processing-dialog__hint">j/k move | tab toggles | enter confirms</div>
    </div>
  );
}
