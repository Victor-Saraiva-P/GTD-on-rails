import { EditorSelection, type SelectionRange } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { ReactNode } from "react";

export const INSERT_MARKDOWN_LINK_EVENT = "gtd:insert-markdown-link";

export type InsertMarkdownLinkEventDetail = {
  url: string;
};

const markdownLinkPattern = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export function dispatchInsertMarkdownLink(url: string) {
  window.dispatchEvent(new CustomEvent<InsertMarkdownLinkEventDetail>(INSERT_MARKDOWN_LINK_EVENT, { detail: { url } }));
}

/**
 * Inserts a markdown link at each active CodeMirror selection.
 *
 * @example insertMarkdownLink(view, "https://example.com")
 */
export function insertMarkdownLink(view: EditorView, url: string) {
  const markdownLink = markdownLinkFromUrl(url);
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

function markdownLinkFromUrl(url: string): string | null {
  const trimmedUrl = url.trim();
  return trimmedUrl ? `[${trimmedUrl}](${trimmedUrl})` : null;
}

export function renderMarkdownLinks(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(markdownLinkPattern)) {
    pushTextBeforeLink(nodes, line, lastIndex, match.index ?? 0);
    nodes.push(renderMarkdownLink(match[1], match[2], match.index ?? 0));
    lastIndex = (match.index ?? 0) + match[0].length;
  }

  pushTextBeforeLink(nodes, line, lastIndex, line.length);
  return nodes.length > 0 ? nodes : [line || "\u00A0"];
}

function pushTextBeforeLink(nodes: ReactNode[], line: string, from: number, to: number) {
  if (to > from) {
    nodes.push(line.slice(from, to));
  }
}

function renderMarkdownLink(text: string, href: string, index: number) {
  return (
    <a className="inbox-detail__body-link" href={href} key={`${index}:${href}`} rel="noreferrer" target="_blank">
      {text}
    </a>
  );
}
