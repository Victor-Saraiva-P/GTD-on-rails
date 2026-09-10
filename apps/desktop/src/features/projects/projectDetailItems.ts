import type { ProjectItem } from "./projectItems";

/**
 * Prepends a draft project item to the list so new stuff is created in the first position.
 *
 * @example projectItemsWithDraft(draftItem, projectActions)
 */
export function projectItemsWithDraft(draft: ProjectItem | null, items: ProjectItem[]): ProjectItem[] {
  return draft ? [draft, ...items] : items;
}
