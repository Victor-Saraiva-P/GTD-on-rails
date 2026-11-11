/**
 * Opens the selected Stuff's pending recommendation with one keystroke.
 * Calling the existing Review button preserves its normal state and focus handling.
 * @example openAgentReviewFromShortcut(stuff.id)
 */
export function openAgentReviewFromShortcut(
  stuffId: string | undefined,
  elements: Pick<Document, "getElementById"> = document
): boolean {
  if (!stuffId) return false;
  const trigger = elements.getElementById(`agent-review-trigger-${stuffId}`);
  if (trigger) {
    trigger.click();
    return true;
  }

  const review = elements.getElementById(`agent-review-root-${stuffId}`);
  if (review?.getAttribute("data-agent-review-active") !== "true") return false;
  review.focus();
  return true;
}
