export type InlineMark = {
  id: string;
  type:
    | "bold"
    | "italic"
    | "inlineCode"
    | "link"
    | "highlight"
    | "textColor"
    | "backgroundColor";
  from: number;
  to: number;
  attrs?: {
    href?: string;
    color?: string;
  };
};

export type LineBlock = {
  id: string;
  type:
    | "paragraph"
    | "heading1"
    | "heading2"
    | "heading3"
    | "bullet"
    | "numbered"
    | "lettered"
    | "quote"
    | "checklist"
    | "divider";
  from: number;
  to: number;
  attrs?: {
    checked?: boolean;
  };
};

export type BlockEntity = {
  id: string;
  type: "image" | "pdf" | "docx" | "xlsx" | "file";
  from: number;
  to: number;
  assetId: string;
  attrs?: {
    displayName?: string;
    contentType?: string;
    relativePath?: string;
    url?: string;
    localPath?: string;
  };
};

export type ItemBody = {
  text: string;
  inlineMarks: InlineMark[];
  lineBlocks: LineBlock[];
  blockEntities: BlockEntity[];
};

export type Stuff = {
  id: string;
  title: string;
  body: ItemBody;
  status: string;
  createdAt?: string;
  energy?: number | null;
  estimatedTime?: { hours: number; minutes: number } | null;
  contexts?: Array<{ id: string; name: string; iconUrl?: string; iconRevision?: number }>;
};

/**
 * Splits optional stuff body text into display lines for detail rendering.
 *
 * @example getStuffBodyLines(stuff.body)
 */
export function getStuffBodyLines(body: ItemBody | null | undefined): string[] {
  if (!body || !body.text) {
    return [];
  }

  return body.text
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•]\s+/, ""))
    .filter(Boolean);
}

/**
 * Splits body text into preview lines while preserving blank lines.
 *
 * @example getStuffBodyPreviewLines("line 1\n\nline 3")
 */
export function getStuffBodyPreviewLines(body: ItemBody | null | undefined): string[] {
  if (!body || !body.text) {
    return [];
  }

  return body.text.split("\n");
}

/**
 * Formats an API timestamp for compact list metadata.
 *
 * @example formatStuffCreatedAt(stuff.createdAt)
 */
export function formatStuffCreatedAt(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(createdAt));
}

/**
 * Checks if two item bodies are exactly the same.
 *
 * @example isSameBody(item.body, newBody)
 */
export function isSameBody(a: ItemBody, b: ItemBody): boolean {
  return a.text === b.text && JSON.stringify(a) === JSON.stringify(b);
}
