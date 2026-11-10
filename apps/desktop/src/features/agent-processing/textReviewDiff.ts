/** A unified, line-oriented preview of the original and proposed GTD text. */
export type ReviewDiffLine = Readonly<{
  kind: "same" | "remove" | "add";
  text: string;
}>;

function textLines(text: string): string[] {
  return text === "" ? [] : text.split("\n");
}

function replacementLines(before: string[], after: string[]): ReviewDiffLine[] {
  return [
    ...before.map(text => ({ kind: "remove" as const, text })),
    ...after.map(text => ({ kind: "add" as const, text }))
  ];
}

function lcsLengths(before: string[], after: string[]): number[][] {
  const lengths = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let row = before.length - 1; row >= 0; row--) {
    for (let col = after.length - 1; col >= 0; col--) {
      lengths[row][col] = before[row] === after[col] ? 1 + lengths[row + 1][col + 1] : Math.max(lengths[row + 1][col], lengths[row][col + 1]);
    }
  }
  return lengths;
}

function traceDiff(before: string[], after: string[], lengths: number[][]): ReviewDiffLine[] {
  const result: ReviewDiffLine[] = [];
  let oldLine = 0, newLine = 0;
  while (oldLine < before.length && newLine < after.length) {
    if (before[oldLine] === after[newLine]) {
      result.push({ kind: "same", text: before[oldLine++] }); newLine++;
    } else if (lengths[oldLine + 1][newLine] >= lengths[oldLine][newLine + 1]) {
      result.push({ kind: "remove", text: before[oldLine++] });
    } else result.push({ kind: "add", text: after[newLine++] });
  }
  return [...result, ...replacementLines(before.slice(oldLine), after.slice(newLine))];
}

/** Computes a faithful line diff, bounding costly LCS matching for long notes.
 * @example diffReviewText("Call tomorrow", "Call today")
 */
export function diffReviewText(before: string, after: string): ReviewDiffLine[] {
  if (before === after) return [];
  const oldLines = textLines(before);
  const newLines = textLines(after);
  if (oldLines.length * newLines.length > 40_000) return replacementLines(oldLines, newLines);
  return traceDiff(oldLines, newLines, lcsLengths(oldLines, newLines));
}
