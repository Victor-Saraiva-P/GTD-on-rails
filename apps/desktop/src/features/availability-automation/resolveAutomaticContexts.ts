import type { ContextItem } from "../contexts/types.ts";
import type { AvailabilityAutomationSettings, AvailabilityEnvironmentSignals } from "./types.ts";

/** Resolves configured environment signals into existing GTD contexts.
 *
 * Missing or deleted contexts are ignored, and duplicate mappings collapse to one context.
 *
 * @example resolveAutomaticContexts(contexts, signals, settings)
 */
export function resolveAutomaticContexts(
  contexts: ContextItem[],
  signals: AvailabilityEnvironmentSignals,
  settings: AvailabilityAutomationSettings
): ContextItem[] {
  const availableById = new Map(contexts.map((context) => [context.id, context]));
  const mappedIds = [
    settings.deviceContextId,
    ...signals.locations.map((location) => settings.locationContextIds[location.id] ?? null)
  ];
  const uniqueIds = [...new Set(mappedIds.filter((id): id is string => Boolean(id)))];
  return uniqueIds.map((id) => availableById.get(id)).filter((context): context is ContextItem => Boolean(context));
}
