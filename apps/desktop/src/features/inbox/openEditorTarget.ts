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
  if (link?.attrs?.href) return { type: "link", url: link.attrs.href };

  const nativeLinkUrl = findMarkdownLinkAtPosition(body.text, cursorPosition);
  return nativeLinkUrl ? { type: "link", url: nativeLinkUrl } : null;
}

function findMarkdownLinkAtPosition(text: string, pos: number): string | null {
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const openLabel = text.indexOf("[", searchFrom);
    if (openLabel < 0) return null;
    const closeLabel = text.indexOf("](", openLabel + 1);
    if (closeLabel < 0) return null;
    const closeTarget = text.indexOf(")", closeLabel + 2);
    if (closeTarget < 0) return null;
    if (pos >= openLabel && pos <= closeTarget) {
      return text.slice(closeLabel + 2, closeTarget).trim();
    }
    searchFrom = closeTarget + 1;
  }
  return null;
}

function linkContainsCursor(mark: InlineMark, cursorPosition: number): boolean {
  return mark.type === "link" && rangeContainsCursor(mark.from, mark.to, cursorPosition);
}

function rangeContainsCursor(from: number, to: number, cursorPosition: number): boolean {
  return cursorPosition >= from && cursorPosition <= to;
}
