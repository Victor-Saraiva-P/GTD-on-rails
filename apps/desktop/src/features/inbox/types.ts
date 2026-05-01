export type RichTextMark = "bold" | "italic" | "underline" | "strikethrough" | "code";

export type RichTextRun = {
  text: string;
  marks?: RichTextMark[];
  textColor?: string;
  backgroundColor?: string;
  link?: string;
};

export type ParagraphProperties = {
  richText: RichTextRun[];
};

export type BodyBlock = {
  id: string;
  type: string;
  properties: ParagraphProperties;
  content?: BodyBlock[];
};

export type Body = {
  version: number;
  blocks: BodyBlock[];
};

export type Stuff = {
  id: string;
  title: string;
  body: Body | null;
  status: string;
  createdAt: string;
};

/**
 * Splits optional stuff body text into display lines for detail rendering.
 *
 * @example getStuffBodyLines(stuff.body)
 */
export function getStuffBodyLines(body: Body | null): string[] {
  if (!body || !body.blocks) {
    return [];
  }

  return body.blocks
    .filter((block) => block.type === "paragraph")
    .map((block) => {
      const text = block.properties.richText.map((run) => run.text).join("");
      return text.trim().replace(/^[-*•]\s+/, "");
    })
    .filter(Boolean);
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
