import type { Project } from "./types";
import { formatProjectDeadline } from "./types";

type ProjectsListProps = Readonly<{
  items: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}>;

function ProjectCard({ item, selected, onSelect }: Readonly<{ item: Project; selected: boolean; onSelect: (id: string) => void }>) {
  const deadline = formatProjectDeadline(item.deadline);
  return (
    <li className="project-card-list__item">
      <button type="button" className={`project-card${selected ? " project-card--active" : ""}`} data-project-id={item.id} onClick={() => onSelect(item.id)}>
        <span className="project-card__glyph" aria-hidden="true">P</span>
        <span className="project-card__title">{item.title}</span>
        <span className="project-card__deadline">{deadline ?? "No deadline"}</span>
      </button>
    </li>
  );
}

/**
 * Renders project cards for the Projects page.
 *
 * @example <ProjectsList items={projects} selectedId={id} onSelect={select} />
 */
export function ProjectsList({ items, selectedId, onSelect }: ProjectsListProps) {
  return (
    <ol className="project-card-list" aria-label="Projects">
      {items.map((item) => <ProjectCard key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />)}
    </ol>
  );
}
