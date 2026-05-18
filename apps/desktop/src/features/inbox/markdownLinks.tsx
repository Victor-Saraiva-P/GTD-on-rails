import { EditorSelection, type SelectionRange } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { ReactNode } from "react";
import { buildApiUrl } from "../../config/env";

export const INSERT_MARKDOWN_LINK_EVENT = "gtd:insert-markdown-link";

export type InsertMarkdownLinkEventDetail = {
  image?: boolean;
  text?: string;
  url: string;
};

const markdownImagePattern = /!\[([^]\n]*)]\(([^)\s]+)\)/g;
const markdownLinkPattern = /\[([^]\n]+)]\(([^)\s]+)\)/g;

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

export function renderMarkdownLinks(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of markdownMatches(line)) {
    pushTextBeforeLink(nodes, line, lastIndex, match.index);
    nodes.push(match.image ? renderMarkdownImage(match.text, match.href, match.index) : renderMarkdownLink(match.text, match.href, match.index));
    lastIndex = match.index + match.raw.length;
  }

  pushTextBeforeLink(nodes, line, lastIndex, line.length);
  return nodes.length > 0 ? nodes : [line || "\u00A0"];
}

type MarkdownMatch = {
  href: string;
  image: boolean;
  index: number;
  raw: string;
  text: string;
};

export function markdownMatches(line: string): MarkdownMatch[] {
  const imageMatches = Array.from(line.matchAll(markdownImagePattern), (match) => markdownMatch(match, true));
  const linkMatches = Array.from(line.matchAll(markdownLinkPattern), (match) => markdownMatch(match, false))
    .filter((match) => line.charAt(match.index - 1) !== "!");

  return [...imageMatches, ...linkMatches].sort((a, b) => a.index - b.index);
}

function markdownMatch(match: RegExpMatchArray, image: boolean): MarkdownMatch {
  return {
    href: match[2],
    image,
    index: match.index ?? 0,
    raw: match[0],
    text: match[1]
  };
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

function renderMarkdownImage(text: string, href: string, index: number) {
  return <img alt={text} className="inbox-detail__body-image" key={`${index}:${href}`} src={buildApiUrl(href)} />;
}
