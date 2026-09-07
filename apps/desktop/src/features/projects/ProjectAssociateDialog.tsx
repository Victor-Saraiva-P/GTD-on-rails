import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { fetchProjects } from "./api";
import type { Project } from "./types";

export type ProjectAssociableItem = {
  title: string;
  projectTitle?: string | null;
};

type ProjectAssociateDialogProps = Readonly<{
  item: ProjectAssociableItem;
  onClose: () => void;
  onAssociate: (projectId: string | null) => void;
}>;

function filterActiveProjects(projects: Project[], query: string): Project[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return projects;
  return projects.filter((project) => project.title.toLowerCase().includes(normalized));
}

function initialProjectIndex(projects: Project[], currentProjectTitle: string | null | undefined): number {
  if (!currentProjectTitle) return 0;
  const matchIndex = projects.findIndex((project) => project.title === currentProjectTitle);
  return matchIndex >= 0 ? matchIndex : 0;
}

function nextFocusedProjectIndex(currentIndex: number, delta: number, maxCount: number): number {
  if (maxCount <= 0) return 0;
  return Math.min(Math.max(currentIndex + delta, 0), maxCount - 1);
}

function projectItemClass(isFocused: boolean, isCurrent: boolean): string {
  const classes = ["processing-dialog__list-item"];
  if (isFocused) classes.push("processing-dialog__list-item--focused");
  if (isCurrent) classes.push("processing-dialog__list-item--checked");
  return classes.join(" ");
}

/**
 * Renders an isolated modal dialog to associate an item with an active project.
 *
 * @example <ProjectAssociateDialog item={item} onClose={close} onAssociate={save} />
 */
export function ProjectAssociateDialog({ item, onClose, onAssociate }: ProjectAssociateDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredProjects = filterActiveProjects(projects, filterText);
  const hasCurrentProject = Boolean(item.projectTitle);
  const totalOptions = filteredProjects.length + (hasCurrentProject ? 1 : 0);

  useEffect(() => {
    let active = true;
    void fetchProjects().then((loaded) => {
      if (!active) return;
      setProjects(loaded);
      setIsLoading(false);
      setFocusedIndex(initialProjectIndex(loaded, item.projectTitle));
    });
    return () => { active = false; };
  }, [item.projectTitle]);

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, [isLoading]);

  const confirmFocused = () => {
    if (hasCurrentProject && focusedIndex === filteredProjects.length) {
      onAssociate(null);
      return;
    }
    const targetProject = filteredProjects[focusedIndex];
    if (targetProject) onAssociate(targetProject.id);
  };

  const handleNavigationKey = (key: string) => {
    const delta = key === "ArrowDown" ? 1 : -1;
    setFocusedIndex((current) => nextFocusedProjectIndex(current, delta, totalOptions));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      handleNavigationKey(event.key);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      confirmFocused();
      return;
    }
    if (event.key === "Delete" && hasCurrentProject) {
      event.preventDefault();
      onAssociate(null);
    }
  };

  return (
    <dialog className="processing-dialog" aria-modal="true" aria-label="Associate to project" open onKeyDown={handleKeyDown}>
      <div className="processing-dialog__title">Associate to Project</div>
      <div className="processing-dialog__content">
        <div className="processing-dialog__hint" style={{ marginBottom: 4 }}>Item: {item.title}</div>
        <input
          ref={inputRef}
          className="processing-dialog__input"
          placeholder="Type to filter projects..."
          value={filterText}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setFilterText(event.target.value);
            setFocusedIndex(0);
          }}
        />
        <div className="processing-dialog__list" role="listbox" aria-label="Active projects">
          {isLoading ? (
            <div className="processing-dialog__list-item processing-dialog__list-item--muted">Loading projects...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="processing-dialog__list-item processing-dialog__list-item--muted">No matching projects.</div>
          ) : (
            filteredProjects.map((project, index) => {
              const isCurrent = project.title === item.projectTitle;
              return (
                <button
                  key={project.id}
                  type="button"
                  tabIndex={-1}
                  className={projectItemClass(index === focusedIndex, isCurrent)}
                  onClick={() => onAssociate(project.id)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span className="processing-dialog__check" aria-hidden="true">{isCurrent ? "[P]" : "[ ]"}</span>
                  <span>{project.title}</span>
                </button>
              );
            })
          )}
          {!isLoading && hasCurrentProject ? (
            <button
              type="button"
              tabIndex={-1}
              className={projectItemClass(focusedIndex === filteredProjects.length, false)}
              style={{ color: "#f08a72" }}
              onClick={() => onAssociate(null)}
              onMouseEnter={() => setFocusedIndex(filteredProjects.length)}
            >
              <span aria-hidden="true">[✕]</span>
              <span>Remove project association</span>
            </button>
          ) : null}
        </div>
        <div className="processing-dialog__hint">
          Arrows move | Enter selects{hasCurrentProject ? " | Del unassigns" : ""} | Esc cancels
        </div>
      </div>
    </dialog>
  );
}
