import { EditorSelection, type SelectionRange } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export const INSERT_MARKDOWN_LINK_EVENT = "gtd:insert-markdown-link";

export type InsertMarkdownLinkEventDetail = {
  image?: boolean;
  text?: string;
  url: string;
};

export function dispatchInsertMarkdownLink(url: string, text?: string, image = false) {
  window.dispatchEvent(new CustomEvent<InsertMarkdownLinkEventDetail>(INSERT_MARKDOWN_LINK_EVENT, { detail: { image, text, url } }));
}

/**
 * Inserts a markdown link at each active CodeMirror selection.
 *
 * @example insertMarkdownLink(view, "https://example.com")
 */
export function insertMarkdownLink(view: EditorView, url: string, text?: string, image = false) {
  const markdownLink = markdownLinkFromUrl(url, text, image);
  if (!markdownLink) {
    return;
  }

  view.dispatch({
    ...view.state.changeByRange((range) => insertMarkdownLinkAtRange(range, markdownLink)),
    scrollIntoView: true
  });
  view.focus();
}

function insertMarkdownLinkAtRange(range: SelectionRange, markdownLink: string) {
  return {
    changes: { from: range.from, to: range.to, insert: markdownLink },
    range: EditorSelection.cursor(range.from + markdownLink.length)
  };
}

function markdownLinkFromUrl(url: string, text?: string, image = false): string | null {
  const trimmedUrl = url.trim();
  const trimmedText = text?.trim() || trimmedUrl;
  const prefix = image ? "!" : "";
  return trimmedUrl ? `${prefix}[${trimmedText}](${trimmedUrl})` : null;
}
