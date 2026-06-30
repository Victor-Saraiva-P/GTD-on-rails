export type Project = {
  id: string;
  title: string;
  deadline?: string | null;
};

export type ProjectPatch = {
  title?: string;
  deadline?: string | null;
  clearDeadline?: boolean;
};

/**
 * Formats a project deadline for card metadata.
 *
 * @example formatProjectDeadline("2028-02-29")
 */
export function formatProjectDeadline(deadline?: string | null): string | null {
  if (!deadline) return null;
  const date = new Date(`${deadline}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
