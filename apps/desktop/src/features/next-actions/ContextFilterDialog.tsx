import { useEffect, useRef, type ReactNode } from "react";
import { ContextNameWithIcon } from "../contexts/ContextNameWithIcon";
import type { ContextItem } from "../contexts/types";

type ContextFilterDialogProps = Readonly<{
  contexts: ContextItem[];
  currentContextId: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onSelect: (context: ContextItem | null) => void;
  onClose: () => void;
}>;

function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);
}

function ContextOption(props: Readonly<{ active: boolean; children: ReactNode; onClick: () => void }>) {
  return (
    <button type="button" className={`context-filter__option${props.active ? " context-filter__option--active" : ""}`} onClick={props.onClick}>
      <span>{props.active ? "●" : "○"}</span>
      <span>{props.children}</span>
    </button>
  );
}

function ContextFilterBody(props: ContextFilterDialogProps) {
  if (props.isLoading) return <p className="pane-state">Loading contexts...</p>;
  if (props.errorMessage) return <button className="context-filter__retry" type="button" onClick={props.onRetry}>{props.errorMessage}</button>;
  return (
    <div className="context-filter__list" role="list">
      <ContextOption active={!props.currentContextId} onClick={() => props.onSelect(null)}>All contexts</ContextOption>
      {props.contexts.map((context) => (
        <ContextOption key={context.id} active={context.id === props.currentContextId} onClick={() => props.onSelect(context)}><ContextNameWithIcon context={context} /></ContextOption>
      ))}
    </div>
  );
}

/**
 * Shows a context picker for next action filtering.
 *
 * @example <ContextFilterDialog contexts={contexts} currentContextId={null} ... />
 */
export function ContextFilterDialog(props: ContextFilterDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEscapeClose(props.onClose);
  useEffect(() => panelRef.current?.focus(), []);

  return (
    <div className="context-filter" role="dialog" aria-modal="true" aria-label="Filter next actions by context">
      <div ref={panelRef} className="context-filter__panel" tabIndex={-1}>
        <h2 className="context-filter__title">Filter Context</h2>
        <ContextFilterBody {...props} />
        <p className="context-filter__hint">Esc Cancel</p>
      </div>
    </div>
  );
}
