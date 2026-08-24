/**
 * Decides whether the native release updater may run for this frontend boot.
 *
 * @example shouldCheckNativeUpdates(true, false)
 */
export function shouldCheckNativeUpdates(isTauri: boolean, isDevMode: boolean): boolean {
  if (!isTauri) return false;
  return !isDevMode;
}

export type StartupStep = "native-update" | "sidecar";

/**
 * Returns the ordered packaged startup phases.
 *
 * @example startupSteps(true, false)
 */
export function startupSteps(isTauri: boolean, isDevMode: boolean): StartupStep[] {
  if (!isTauri) return [];
  if (isDevMode) return ["sidecar"];
  return ["native-update", "sidecar"];
}
