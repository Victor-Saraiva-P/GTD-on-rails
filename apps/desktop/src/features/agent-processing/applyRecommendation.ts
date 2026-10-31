import { apiFetch } from "../../lib/api/apiClient.ts";
import type { Stuff } from "../inbox/types";
import type { AgentRecommendationOption } from "./types";

export type RecommendationApproval = (
  stuffId: string, option: AgentRecommendationOption, title: string
) => Promise<void>;

/** Sends the accepted decision as one atomic backend conversion.
 * @example await submitApprovedRecommendation(stuff.id, option, "Email draft")
 */
export async function submitApprovedRecommendation(
  stuffId: string, option: AgentRecommendationOption, title: string
): Promise<void> {
  await apiFetch(`/inbox/${stuffId}/approve-recommendation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...option, title })
  });
}

/** Only an explicit human confirmation calls this function; agent runs cannot convert.
 * @example await applyRecommendation(stuff, option, "Email draft")
 */
export async function applyRecommendation(
  stuff: Stuff, option: AgentRecommendationOption, title: string,
  approve: RecommendationApproval = submitApprovedRecommendation
): Promise<void> {
  const normalized = title.trim();
  if (!normalized || normalized.length > 500) throw new Error("A proposed title must have 1–500 characters.");
  if (option.kind === "calendar" && !option.scheduledDate) throw new Error("Calendar recommendations require a scheduled date.");
  if (option.energy != null && (!Number.isFinite(option.energy) || option.energy < 0 || option.energy > 10)) throw new Error("Energy must be from 0 to 10.");
  if (option.minutes != null && (!Number.isInteger(option.minutes) || option.minutes < 0)) throw new Error("Minutes must be a nonnegative whole number.");
  await approve(stuff.id, option, normalized);
}
