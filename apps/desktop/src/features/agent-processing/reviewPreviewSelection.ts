import type { AgentRecommendationOption } from "./types";

export type ActiveAgentReview = Readonly<{
  stuffId: string;
  option: AgentRecommendationOption;
}>;

/** Retain only the active Stuff's review preview; a stale row cannot clear another row.
 * @example updateActiveAgentReview(current, "stuff-1", null)
 */
export function updateActiveAgentReview(
  current: ActiveAgentReview | null,
  stuffId: string,
  option: AgentRecommendationOption | null
): ActiveAgentReview | null {
  if (!option) return current?.stuffId === stuffId ? null : current;
  if (current?.stuffId === stuffId && current.option === option) return current;
  return { stuffId, option };
}

/** Never show a previous Stuff's proposed text in the selected detail pane.
 * @example selectedReviewOption(preview, "stuff-1")
 */
export function selectedReviewOption(
  preview: ActiveAgentReview | null,
  selectedStuffId: string | undefined
): AgentRecommendationOption | null {
  if (!preview || !selectedStuffId) return null;
  return preview.stuffId === selectedStuffId ? preview.option : null;
}
