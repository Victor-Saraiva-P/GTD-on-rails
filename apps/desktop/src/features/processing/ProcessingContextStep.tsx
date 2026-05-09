import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { useContextsQuery } from "../contexts/useContextsQuery";
import type { ContextItem } from "../contexts/types";

type ProcessingContextStepProps = {
  onContextSelected: (context: ContextItem) => void;
  onCancel: () => void;
};

export function ProcessingContextStep({ onContextSelected, onCancel }: ProcessingContextStepProps) {
  const { contexts, isLoading } = useContextsQuery();
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredContexts = useMemo(() => {
    if (!filter.trim()) return contexts;
    const lowerFilter = filter.toLowerCase();
    
    return contexts
      .filter(c => c.name.toLowerCase().includes(lowerFilter))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        const aExact = aName === lowerFilter;
        const bExact = bName === lowerFilter;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        const aStarts = aName.startsWith(lowerFilter);
        const bStarts = bName.startsWith(lowerFilter);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        return aName.localeCompare(bName);
      });
  }, [contexts, filter]);

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(() => {
    if (filteredContexts[selectedIndex]) {
      onContextSelected(filteredContexts[selectedIndex]);
    }
  }, [filteredContexts, selectedIndex, onContextSelected]);

  const moveDown = useCallback(() => {
    setSelectedIndex(prev => Math.min(prev + 1, Math.max(0, filteredContexts.length - 1)));
  }, [filteredContexts.length]);

  const moveUp = useCallback(() => {
    setSelectedIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const focusOtherTarget = () => {
    if (document.activeElement === inputRef.current) listRef.current?.focus();
    else inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isListFocused = document.activeElement === listRef.current;
    const isHandled = ["Escape", "Tab", "Enter"].includes(event.key) || (isListFocused && ["j", "k"].includes(event.key));
    if (!isHandled) return;

    if (event.key === "Escape") onCancel();
    if (event.key === "Tab") focusOtherTarget();
    if (event.key === "Enter") handleSelect();
    if (isListFocused && event.key === "j") moveDown();
    if (isListFocused && event.key === "k") moveUp();
      event.preventDefault();
      event.stopPropagation();
  };

  return (
    <div className="processing-dialog__step processing-dialog__step--context" onKeyDown={handleKeyDown}>
      <input 
        ref={inputRef}
        type="text" 
        className="processing-dialog__input"
        placeholder="Filter contexts..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div 
        ref={listRef} 
        className="processing-dialog__list" 
        tabIndex={-1}
      >
        {isLoading ? (
          <div className="processing-dialog__list-item processing-dialog__list-item--muted">Loading...</div>
        ) : filteredContexts.length === 0 ? (
          <div className="processing-dialog__list-item processing-dialog__list-item--muted">No contexts found</div>
        ) : (
          filteredContexts.map((ctx, idx) => (
            <div 
              key={ctx.id} 
              className={`processing-dialog__list-item ${idx === selectedIndex ? 'processing-dialog__list-item--selected' : ''}`}
              onClick={() => onContextSelected(ctx)}
            >
              {ctx.name}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
