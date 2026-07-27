/** Reports whether normal desktop interaction must wait for PostgreSQL.
 *
 * @example shouldBlockDatabaseInteraction(false, false)
 */
export function shouldBlockDatabaseInteraction(isReady: boolean, requestFailed: boolean): boolean {
  return !isReady || requestFailed;
}

/** Reports whether the recovered database requires a fresh authoritative application load.
 *
 * @example shouldReloadAfterDatabaseRecovery(true, true)
 */
export function shouldReloadAfterDatabaseRecovery(wasBlocked: boolean, isReady: boolean): boolean {
  return wasBlocked && isReady;
}
