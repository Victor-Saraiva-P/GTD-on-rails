import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ContextNameWithIcon } from "../contexts/ContextNameWithIcon";
import type { ContextItem } from "../contexts/types";
import type { NextAction, NextActionPatch } from "./types";

type NextActionAttributesDialogProps = {
  contexts: ContextItem[];
  item: NextAction;
  isBusy: boolean;
  onSave: (patch: NextActionPatch) => Promise<void>;
  onClose: () => void;
};

function totalMinutes(item: NextAction): string {
  if (!item.estimatedTime) return "";
  return String(item.estimatedTime.hours * 60 + item.estimatedTime.minutes);
}

function initialContextIds(item: NextAction): string[] {
  return item.contexts?.map((context) => context.id) ?? [];
}

function buildEstimatedTime(value: string) {
  const minutes = Number(value || 0);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

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

function toggleContext(selectedIds: string[], contextId: string): string[] {
  return selectedIds.includes(contextId)
    ? selectedIds.filter((selectedId) => selectedId !== contextId)
    : [...selectedIds, contextId];
}

function ContextCheckboxes(props: { contexts: ContextItem[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="next-action-attrs__contexts">
      {props.contexts.map((context) => (
        <label className="next-action-attrs__context" key={context.id}>
          <input type="checkbox" checked={props.selectedIds.includes(context.id)} onChange={() => props.onToggle(context.id)} />
          <ContextNameWithIcon context={context} />
        </label>
      ))}
    </div>
  );
}

/**
 * Edits next action attributes that are not title/body content.
 *
 * @example <NextActionAttributesDialog item={item} contexts={contexts} ... />
 */
export function NextActionAttributesDialog(props: NextActionAttributesDialogProps) {
  const [energy, setEnergy] = useState(props.item.energy == null ? "" : String(props.item.energy));
  const [minutes, setMinutes] = useState(totalMinutes(props.item));
  const [selectedIds, setSelectedIds] = useState(initialContextIds(props.item));
  const patch = useMemo(() => buildPatch(energy, minutes, selectedIds), [energy, minutes, selectedIds]);
  useEscapeClose(props.onClose);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void props.onSave(patch);
  };

  return (
    <div className="next-action-attrs" role="dialog" aria-modal="true" aria-label="Edit next action attributes">
      <form className="next-action-attrs__panel" onSubmit={submit}>
        <h2 className="next-action-attrs__title">Edit Next Action</h2>
        <label>Energy<input value={energy} onChange={(event) => setEnergy(event.target.value)} inputMode="decimal" autoFocus /></label>
        <label>Estimated minutes<input value={minutes} onChange={(event) => setMinutes(event.target.value)} inputMode="numeric" /></label>
        <ContextCheckboxes contexts={props.contexts} selectedIds={selectedIds} onToggle={(id) => setSelectedIds((ids) => toggleContext(ids, id))} />
        <div className="next-action-attrs__actions">
          <button type="submit" disabled={props.isBusy}>Save</button>
          <button type="button" onClick={props.onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function buildPatch(energy: string, minutes: string, contextIds: string[]): NextActionPatch {
  return {
    energy: energy.trim() ? Number(energy) : null,
    estimatedTime: minutes.trim() ? buildEstimatedTime(minutes) : null,
    contextIds
  };
}
