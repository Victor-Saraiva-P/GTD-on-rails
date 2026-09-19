import type { BlockEntity, InlineMark, ItemBody } from "./types.ts";

export type OpenableEditorTarget =
  | { type: "link"; url: string }
  | { type: "asset"; entity: BlockEntity };

const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

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
  for (const match of text.matchAll(MD_LINK_RE)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (pos >= from && pos <= to) {
      return match[2].trim();
    }
  }
  return null;
}

function linkContainsCursor(mark: InlineMark, cursorPosition: number): boolean {
  return mark.type === "link" && rangeContainsCursor(mark.from, mark.to, cursorPosition);
}

function rangeContainsCursor(from: number, to: number, cursorPosition: number): boolean {
  return cursorPosition >= from && cursorPosition <= to;
}
