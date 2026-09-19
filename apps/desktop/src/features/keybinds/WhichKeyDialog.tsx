import { useEffect, useMemo, useState } from "react";
import { useKeybindContext } from "./KeybindProvider";
import { filterKeybinds, formatKeybindDisplay, groupKeybindsByCategory, type KeybindCategory } from "./whichKeyUtils";
import type { KeybindDefinition } from "./types";

const CATEGORY_ORDER: readonly KeybindCategory[] = [
  "Actions",
  "Navigation",
  "Leader Shortcuts",
  "Formatting"
];

function WhichKeyHeader({ activeZone }: Readonly<{ activeZone: string }>) {
  return (
    <div className="which-key-dialog__header">
      <div className="which-key-dialog__title-group">
        <span className="which-key-dialog__badge">Which-Key</span>
        <h2 className="which-key-dialog__title">Available Keybindings</h2>
      </div>
      <span className="which-key-dialog__zone-pill">{activeZone}</span>
    </div>
  );
}

function WhichKeySearch({
  query,
  onQueryChange
}: Readonly<{ query: string; onQueryChange: (val: string) => void }>) {
  return (
    <div className="which-key-dialog__search-wrap">
      <input
        type="text"
        className="which-key-dialog__search"
        placeholder="Filter keybindings (e.g. 'j', 'delete', 'Space')..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoFocus
      />
    </div>
  );
}

function KeybindToken({ token }: Readonly<{ token: string }>) {
  return <kbd>{token}</kbd>;
}

function KeybindRow({ binding }: Readonly<{ binding: KeybindDefinition }>) {
  const display = formatKeybindDisplay(binding);
  const tokens = display.split(" ").filter(Boolean);

  return (
    <div className="which-key-dialog__item">
      <div className="which-key-dialog__keys">
        {tokens.map((token, index) => (
          <KeybindToken key={`${binding.id}-${index}-${token}`} token={token} />
        ))}
      </div>
      <span className="which-key-dialog__desc">{binding.description}</span>
    </div>
  );
}

function CategorySection({
  category,
  items
}: Readonly<{ category: KeybindCategory; items: KeybindDefinition[] }>) {
  if (items.length === 0) return null;

  return (
    <div className="which-key-dialog__category">
      <h3 className="which-key-dialog__category-title">{category}</h3>
      <div className="which-key-dialog__grid">
        {items.map((item) => (
          <KeybindRow key={item.id} binding={item} />
        ))}
      </div>
    </div>
  );
}

function WhichKeyContent({ groups }: Readonly<{ groups: Record<KeybindCategory, KeybindDefinition[]> }>) {
  const totalItems = Object.values(groups).reduce((sum, list) => sum + list.length, 0);

  if (totalItems === 0) {
    return <div className="which-key-dialog__empty">No keybindings match the search filter.</div>;
  }

  return (
    <div className="which-key-dialog__content">
      {CATEGORY_ORDER.map((category) => (
        <CategorySection key={category} category={category} items={groups[category]} />
      ))}
    </div>
  );
}

function useDialogEscapeClose(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);
}

function WhichKeyModal({
  activeZone,
  query,
  onQueryChange,
  groups,
  onClose
}: Readonly<{
  activeZone: string;
  query: string;
  onQueryChange: (val: string) => void;
  groups: Record<KeybindCategory, KeybindDefinition[]>;
  onClose: () => void;
}>) {
  return (
    <div
      className="which-key-dialog__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="which-key-dialog" role="dialog" aria-modal="true" aria-label="Available Keybindings">
        <WhichKeyHeader activeZone={activeZone} />
        <WhichKeySearch query={query} onQueryChange={onQueryChange} />
        <WhichKeyContent groups={groups} />
        <div className="which-key-dialog__footer">
          <button type="button" className="which-key-dialog__hint" onClick={onClose}>
            Esc to close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal dialog presenting the cheat sheet of available shortcuts for the active focus zone.
 *
 * @example <WhichKeyDialog />
 */
export function WhichKeyDialog() {
  const { activeZone, closeWhichKey, getActiveZoneBindings, isWhichKeyOpen } = useKeybindContext();
  const [query, setQuery] = useState("");

  useDialogEscapeClose(isWhichKeyOpen, closeWhichKey);

  const bindings = useMemo(() => getActiveZoneBindings(), [getActiveZoneBindings]);
  const filtered = useMemo(() => filterKeybinds(bindings, query), [bindings, query]);
  const groups = useMemo(() => groupKeybindsByCategory(filtered), [filtered]);

  if (!isWhichKeyOpen) return null;

  return (
    <WhichKeyModal
      activeZone={activeZone}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      onClose={closeWhichKey}
    />
  );
}
