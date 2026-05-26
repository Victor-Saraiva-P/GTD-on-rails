/**
 * Decides whether the native release updater may run for this frontend boot.
 *
 * @example shouldCheckNativeUpdates(true, false)
 */
export function shouldCheckNativeUpdates(isTauri: boolean, isDevMode: boolean): boolean {
  if (!isTauri) return false;
  return !isDevMode;
}
