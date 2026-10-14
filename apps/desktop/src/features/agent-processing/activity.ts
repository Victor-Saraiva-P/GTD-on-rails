import type { AgentActivity } from "./types";

const MAX_ACTIVITY_ENTRIES = 16;

/** Appends one visible agent activity while collapsing consecutive duplicate updates.
 *
 * @example appendAgentActivity([], { kind: "tool", message: "Inspecting captured stuff" })
 */
export function appendAgentActivity(entries: AgentActivity[], next: AgentActivity): AgentActivity[] {
  const previous = entries[entries.length - 1];
  if (previous?.kind === next.kind && previous.message === next.message) return entries;
  return [...entries, next].slice(-MAX_ACTIVITY_ENTRIES);
}
