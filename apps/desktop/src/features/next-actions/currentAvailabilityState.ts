import type { ContextItem } from "../contexts/types.ts";
import type { AvailabilityContextMode } from "../availability-automation/types.ts";

export type CurrentAvailabilityState = {
  contexts: ContextItem[];
  automaticContexts: ContextItem[];
  currentEnergy: number | null;
  currentTimeMinutes: number | null;
  contextMode: AvailabilityContextMode;
};

export const INITIAL_CURRENT_AVAILABILITY: CurrentAvailabilityState = {
  contexts: [],
  automaticContexts: [],
  currentEnergy: null,
  currentTimeMinutes: null,
  contextMode: "automatic"
};

/** Stores newly detected automatic contexts without overriding an active manual context selection.
 *
 * @example applyAutomaticContexts(state, detectedContexts)
 */
export function applyAutomaticContexts(state: CurrentAvailabilityState, contexts: ContextItem[]): CurrentAvailabilityState {
  return {
    ...state,
    automaticContexts: contexts,
    contexts: state.contextMode === "automatic" ? contexts : state.contexts
  };
}

/** Applies a user-selected current availability and enters manual context mode.
 *
 * @example applyManualAvailability(state, contexts, 6, 30)
 */
export function applyManualAvailability(
  state: CurrentAvailabilityState,
  contexts: ContextItem[],
  currentEnergy: number | null,
  currentTimeMinutes: number | null
): CurrentAvailabilityState {
  return { ...state, contexts, currentEnergy, currentTimeMinutes, contextMode: "manual" };
}

/** Resumes environment-driven contexts from a freshly detected snapshot while preserving energy and time.
 *
 * @example resumeAutomaticAvailability(state, detectedContexts)
 */
export function resumeAutomaticAvailability(state: CurrentAvailabilityState, contexts: ContextItem[]): CurrentAvailabilityState {
  return { ...state, automaticContexts: contexts, contexts, contextMode: "automatic" };
}

/** Clears all current availability values and deliberately remains in manual mode.
 *
 * @example clearCurrentAvailability(state)
 */
export function clearCurrentAvailability(state: CurrentAvailabilityState): CurrentAvailabilityState {
  return { ...state, contexts: [], currentEnergy: null, currentTimeMinutes: null, contextMode: "manual" };
}
