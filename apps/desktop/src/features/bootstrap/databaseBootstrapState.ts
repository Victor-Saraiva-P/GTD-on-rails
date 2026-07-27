export type BootstrapUiState = "setup" | "repair" | "offline";

/** Maps bootstrap status values to the user-facing bootstrap flow.
 *
 * @example bootstrapUiState("INVALID")
 */
export function bootstrapUiState(status: string): BootstrapUiState {
  if (status === "MISSING") return "setup";
  if (status === "INVALID" || status === "REPAIR_FAILED") return "repair";
  return "offline";
}
