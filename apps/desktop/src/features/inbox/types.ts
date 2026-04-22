export type Stuff = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  contexts: StuffContext[];
};

export type StuffContext = {
  id: string;
  name: string;
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
