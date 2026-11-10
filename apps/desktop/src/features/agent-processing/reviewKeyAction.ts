export type ReviewKeyAction = "confirm" | "close" | "manual" | { select: number } | null;

/** Resolves an inline review command without hijacking form input or button activation.
 * @example reviewKeyAction("2", 3, false, false, true)
 */
export function reviewKeyAction(
  key: string, optionCount: number, typing: boolean, buttonFocused: boolean, insideReview: boolean
): ReviewKeyAction {
  if (key === "Escape") return !typing || insideReview ? "close" : null;
  if (typing) return null;
  if (key === "Enter") return buttonFocused ? null : "confirm";
  if (key === "p") return "manual";
  const index = Number(key) - 1;
  if (/^[1-3]$/.test(key) && index < optionCount) return { select: index };
  return null;
}
