import type { KeybindDefinition } from "./types";

export type KeybindCategory = "Actions" | "Navigation" | "Leader Shortcuts" | "Formatting";

export function formatKeybindDisplay(binding: KeybindDefinition): string {
  if (binding.ctrl) {
    return `Ctrl+${binding.key}`;
  }
  if (binding.leader) {
    const seq = binding.sequence ?? [binding.key];
    return `Space ${seq.join(" ")}`;
  }
  if (binding.sequence && binding.sequence.length > 1) {
    return binding.sequence.join(" ");
  }
  return binding.key;
}

function isNavigationKey(binding: KeybindDefinition): boolean {
  const navKeys = new Set(["j", "k", "h", "l", "[", "]", "PageUp", "PageDown"]);
  return navKeys.has(binding.key) || binding.sequence?.[0] === "g" || Boolean(binding.ctrl);
}

export function categorizeKeybind(binding: KeybindDefinition): KeybindCategory {
  if (binding.leader) {
    const firstSeq = binding.sequence?.[0];
    if (firstSeq === "m" || firstSeq === "t") return "Formatting";
    return "Leader Shortcuts";
  }
  if (isNavigationKey(binding)) return "Navigation";
  return "Actions";
}

export function filterKeybinds(bindings: KeybindDefinition[], query: string): KeybindDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return bindings;
  return bindings.filter((binding) => {
    const keyText = formatKeybindDisplay(binding).toLowerCase();
    const descText = binding.description.toLowerCase();
    return keyText.includes(q) || descText.includes(q);
  });
}

export function groupKeybindsByCategory(
  bindings: KeybindDefinition[]
): Record<KeybindCategory, KeybindDefinition[]> {
  const groups: Record<KeybindCategory, KeybindDefinition[]> = {
    Actions: [],
    Navigation: [],
    "Leader Shortcuts": [],
    Formatting: []
  };

  for (const binding of bindings) {
    const cat = categorizeKeybind(binding);
    groups[cat].push(binding);
  }

  return groups;
}
