export type Stuff = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  createdAt: string;
};

export function getStuffBodyLines(body: string | null): string[] {
  if (!body) {
    return [];
  }

  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s+/, ""));
}

export function formatStuffCreatedAt(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(createdAt));
}
