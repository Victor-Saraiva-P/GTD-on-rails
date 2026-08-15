export type DatabaseReadinessStatus = "ready" | "unavailable" | "update-required";

export type DatabaseReadinessBlockerModel = {
  isBlocked: boolean;
  statusLabel: string;
  title: string;
  message: string;
  actionText: string;
};

/** Parses the backend readiness JSON payload to determine the readiness state.
 *
 * @example parseReadinessResponse('{"status":"UPDATE_REQUIRED"}')
 */
export function parseReadinessResponse(responseBody: string | null | undefined): DatabaseReadinessStatus {
  if (!responseBody) return "unavailable";
  try {
    const payload = JSON.parse(responseBody) as { status?: string };
    if (payload.status === "READY") return "ready";
    if (payload.status === "UPDATE_REQUIRED") return "update-required";
  } catch {
    return "unavailable";
  }
  return "unavailable";
}

/** Builds the database readiness blocker model for display.
 *
 * @example buildDatabaseReadinessBlockerModel("update-required")
 */
export function buildDatabaseReadinessBlockerModel(status: DatabaseReadinessStatus): DatabaseReadinessBlockerModel {
  if (status === "update-required") {
    return {
      isBlocked: true,
      statusLabel: "UPDATE",
      title: "Application update required",
      message: "This installation is incompatible with the shared database schema. An application update is required to continue.",
      actionText: "Please install the latest application release"
    };
  }
  return {
    isBlocked: status !== "ready",
    statusLabel: "DATABASE",
    title: "PostgreSQL unavailable",
    message: "Waiting for PostgreSQL to restore authoritative application state.",
    actionText: "Checking database connection"
  };
}

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
