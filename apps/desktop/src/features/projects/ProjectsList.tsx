import type { Project } from "./types";
import { formatProjectActionCount, formatProjectDeadline, isProjectDead } from "./types";

type ProjectsListProps = Readonly<{
  items: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
  activeSubview?: string;
}>;

type ProjectCardProps = Readonly<{
  item: Project;
  selected: boolean;
  onSelect: (id: string) => void;
  activeSubview?: string;
}>;

function ProjectActionIndicator({ count, isDead }: Readonly<{ count: number; isDead: boolean }>) {
  if (isDead) {
    return (
      <span className="project-card__actions project-card__actions--alert" title="Project has no active next actions or calendar entries">
        <span className="project-card__actions-alert-glyph" aria-hidden="true">!</span>
        <span>0 actions</span>
      </span>
    );
  }
  return (
    <span className="project-card__actions">
      <span>{formatProjectActionCount(count)}</span>
    </span>
  );
}

function resolveCardClass(selected: boolean, isDead: boolean): string {
  const classes = ["project-card"];
  if (selected) classes.push("project-card--active");
  if (isDead) classes.push("project-card--no-actions");
  return classes.join(" ");
}

function ProjectCard({ item, selected, onSelect, activeSubview }: ProjectCardProps) {
  const deadline = formatProjectDeadline(item.deadline);
  const count = item.actionCount ?? 0;
  const isDead = isProjectDead(item, activeSubview);
  return (
    <li className="project-card-list__item">
      <button type="button" className={resolveCardClass(selected, isDead)} data-project-id={item.id} onClick={() => onSelect(item.id)}>
        <span className="project-card__heading">
          <span className="project-card__glyph" aria-hidden="true">P</span>
          <span className="project-card__title">{item.title}</span>
        </span>
        <span className="project-card__footer">
          <span className="project-card__deadline">{deadline ?? "No deadline"}</span>
          <ProjectActionIndicator count={count} isDead={isDead} />
        </span>
      </button>
    </li>
  );
}

/**
 * Renders project cards for the Projects page.
 *
 * @example <ProjectsList items={projects} selectedId={id} onSelect={select} />
 */
export function ProjectsList({ items, selectedId, onSelect, activeSubview }: ProjectsListProps) {
  return (
    <ol className="project-card-list" aria-label="Projects">
      {items.map((item) => (
        <ProjectCard
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onSelect={onSelect}
          activeSubview={activeSubview}
        />
      ))}
    </ol>
  );
}
