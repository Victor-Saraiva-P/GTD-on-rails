export type Stuff = {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
};

/**
 * Splits optional stuff body text into display lines for detail rendering.
 *
 * @example getStuffBodyLines(stuff.body)
 */
export function getStuffBodyLines(body: string | null | undefined): string[] {
  if (!body) {
    return [];
  }

  return body
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•]\s+/, ""))
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
