import type { BlockEntity, InlineMark, ItemBody } from "./types.ts";

export type OpenableEditorTarget =
  | { type: "link"; url: string }
  | { type: "asset"; entity: BlockEntity };

/**
 * Finds the link or asset at the current editor cursor.
 *
 * @example findOpenableEditorTarget(body, 12)
 */
export function findOpenableEditorTarget(body: ItemBody, cursorPosition: number): OpenableEditorTarget | null {
  const entity = body.blockEntities.find((candidate) => rangeContainsCursor(candidate.from, candidate.to, cursorPosition));
  if (entity) return { type: "asset", entity };

  const link = body.inlineMarks.find((mark) => linkContainsCursor(mark, cursorPosition));
  return link?.attrs?.href ? { type: "link", url: link.attrs.href } : null;
}

function linkContainsCursor(mark: InlineMark, cursorPosition: number): boolean {
  return mark.type === "link" && rangeContainsCursor(mark.from, mark.to, cursorPosition);
}

function rangeContainsCursor(from: number, to: number, cursorPosition: number): boolean {
  return cursorPosition >= from && cursorPosition <= to;
}
