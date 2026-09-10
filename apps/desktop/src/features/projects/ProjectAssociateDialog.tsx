import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, Dispatch, KeyboardEvent as ReactKeyboardEvent, RefObject, SetStateAction } from "react";
import { fetchProjects } from "./api";
import {
  filterActiveProjects,
  initialProjectIndex,
  nextFocusedProjectIndex,
  resolveProjectAssociateSelection,
  resolveProjectItemClass
} from "./projectAssociateLogic";
import type { Project } from "./types";

export type ProjectAssociableItem = {
  title: string;
  projectTitle?: string | null;
};

export type ProjectAssociateDialogProps = Readonly<{
  item: ProjectAssociableItem | null | undefined;
  isOpen?: boolean;
  onClose: () => void;
  onAssociate: (projectId: string | null) => void;
}>;

function useProjectAssociateQuery(currentProjectTitle?: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchProjects().then((loaded) => {
      if (!active) return;
      setProjects(loaded);
      setIsLoading(false);
      setFocusedIndex(initialProjectIndex(loaded, currentProjectTitle));
    });
    return () => { active = false; };
  }, [currentProjectTitle]);

  return { filterText, focusedIndex, isLoading, projects, setFilterText, setFocusedIndex };
}

function dispatchProjectActionKey(key: string, onClose: () => void, confirm: () => void, unassign: () => void): boolean {
  if (key === "Escape") { onClose(); return true; }
  if (key === "Enter") { confirm(); return true; }
  if (key === "Delete") { unassign(); return true; }
  return false;
}

function dispatchProjectKeyAction(
  event: ReactKeyboardEvent<HTMLElement>,
  onClose: () => void,
  confirm: () => void,
  unassign: () => void
): boolean {
  if (!["Escape", "Enter", "Delete"].includes(event.key)) return false;
  event.preventDefault();
  if (event.key === "Escape") event.stopPropagation();
  return dispatchProjectActionKey(event.key, onClose, confirm, unassign);
}

function dispatchProjectNavigationKey(
  event: ReactKeyboardEvent<HTMLElement>,
  setIndex: Dispatch<SetStateAction<number>>,
  totalOptions: number
) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const delta = event.key === "ArrowDown" ? 1 : -1;
  setIndex((cur) => nextFocusedProjectIndex(cur, delta, totalOptions));
}

type ProjectAssociateListItemProps = Readonly<{
  project: Project;
  index: number;
  focusedIndex: number;
  currentTitle?: string | null;
  onSelect: (id: string) => void;
  onHover: (index: number) => void;
}>;

function ProjectAssociateListItem(props: ProjectAssociateListItemProps) {
  const isCurrent = props.project.title === props.currentTitle;
  return (
    <button
      type="button"
      tabIndex={-1}
      className={resolveProjectItemClass(props.index === props.focusedIndex, isCurrent)}
      onClick={() => props.onSelect(props.project.id)}
      onMouseEnter={() => props.onHover(props.index)}
    >
      <span className="processing-dialog__check" aria-hidden="true">{isCurrent ? "[P]" : "[ ]"}</span>
      <span>{props.project.title}</span>
    </button>
  );
}

function ProjectAssociateRemoveOption({ focused, onSelect, onHover }: Readonly<{
  focused: boolean;
  onSelect: (id: null) => void;
  onHover: () => void;
}>) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={resolveProjectItemClass(focused, false)}
      style={{ color: "#f08a72" }}
      onClick={() => onSelect(null)}
      onMouseEnter={onHover}
    >
      <span aria-hidden="true">[✕]</span>
      <span>Remove project association</span>
    </button>
  );
}

type ProjectAssociateListProps = Readonly<{
  isLoading: boolean;
  filtered: Project[];
  focusedIndex: number;
  currentTitle?: string | null;
  hasCurrentProject: boolean;
  onSelect: (id: string | null) => void;
  onHover: (index: number) => void;
}>;

function renderProjectItems(props: ProjectAssociateListProps) {
  return props.filtered.map((proj, idx) => (
    <ProjectAssociateListItem
      key={proj.id}
      project={proj}
      index={idx}
      focusedIndex={props.focusedIndex}
      currentTitle={props.currentTitle}
      onSelect={props.onSelect}
      onHover={props.onHover}
    />
  ));
}

function ProjectAssociateList(props: ProjectAssociateListProps) {
  if (props.isLoading) {
    return <div className="processing-dialog__list-item processing-dialog__list-item--muted">Loading projects...</div>;
  }
  if (props.filtered.length === 0 && !props.hasCurrentProject) {
    return <div className="processing-dialog__list-item processing-dialog__list-item--muted">No matching projects.</div>;
  }
  return (
    <>
      {renderProjectItems(props)}
      {props.hasCurrentProject && (
        <ProjectAssociateRemoveOption
          focused={props.focusedIndex === props.filtered.length}
          onSelect={props.onSelect}
          onHover={() => props.onHover(props.filtered.length)}
        />
      )}
    </>
  );
}

function ProjectAssociateFilterInput({ inputRef, query }: Readonly<{
  inputRef: RefObject<HTMLInputElement | null>;
  query: ReturnType<typeof useProjectAssociateQuery>;
}>) {
  return (
    <input
      ref={inputRef}
      className="processing-dialog__input"
      placeholder="Type to filter projects..."
      value={query.filterText}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        query.setFilterText(e.target.value);
        query.setFocusedIndex(0);
      }}
    />
  );
}

type ProjectAssociateDialogBodyProps = Readonly<{
  item: ProjectAssociableItem;
  inputRef: RefObject<HTMLInputElement | null>;
  query: ReturnType<typeof useProjectAssociateQuery>;
  filtered: Project[];
  hasCurrentProject: boolean;
  onSelect: (id: string | null) => void;
}>;

function projectAssociateHints(hasCurrentProject: boolean): string {
  return `Arrows move | Enter selects${hasCurrentProject ? " | Del unassigns" : ""} | Esc cancels`;
}

function ProjectAssociateDialogBody(props: ProjectAssociateDialogBodyProps) {
  return (
    <div className="processing-dialog__content">
      <div className="processing-dialog__hint" style={{ marginBottom: 4 }}>Item: {props.item.title}</div>
      <ProjectAssociateFilterInput inputRef={props.inputRef} query={props.query} />
      <div className="processing-dialog__list" role="listbox" aria-label="Active projects">
        <ProjectAssociateList
          isLoading={props.query.isLoading}
          filtered={props.filtered}
          focusedIndex={props.query.focusedIndex}
          currentTitle={props.item.projectTitle}
          hasCurrentProject={props.hasCurrentProject}
          onSelect={props.onSelect}
          onHover={props.query.setFocusedIndex}
        />
      </div>
      <div className="processing-dialog__hint">{projectAssociateHints(props.hasCurrentProject)}</div>
    </div>
  );
}

function useProjectAssociateKeyNavigation(
  query: ReturnType<typeof useProjectAssociateQuery>,
  filtered: Project[],
  hasCurrentProject: boolean,
  selectProject: (id: string | null) => void,
  onClose: () => void
) {
  const totalOptions = filtered.length + (hasCurrentProject ? 1 : 0);
  const confirm = () => {
    const outcome = resolveProjectAssociateSelection(query.focusedIndex, filtered, hasCurrentProject);
    if (outcome.selected) selectProject(outcome.projectId);
  };
  return (e: ReactKeyboardEvent<HTMLElement>) => {
    if (dispatchProjectKeyAction(e, onClose, confirm, () => hasCurrentProject && selectProject(null))) return;
    dispatchProjectNavigationKey(e, query.setFocusedIndex, totalOptions);
  };
}

function ProjectAssociateDialogModal({ item, onClose, onAssociate }: Readonly<{
  item: ProjectAssociableItem;
  onClose: () => void;
  onAssociate: (projectId: string | null) => void;
}>) {
  const query = useProjectAssociateQuery(item.projectTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = filterActiveProjects(query.projects, query.filterText);
  const hasCurrentProject = Boolean(item.projectTitle);
  useLayoutEffect(() => { inputRef.current?.focus(); }, [query.isLoading]);
  const select = (id: string | null) => { onAssociate(id); onClose(); };
  const onKeyDown = useProjectAssociateKeyNavigation(query, filtered, hasCurrentProject, select, onClose);

  return (
    <dialog className="processing-dialog" aria-modal="true" aria-label="Associate to project" open onKeyDown={onKeyDown}>
      <div className="processing-dialog__title">Associate to Project</div>
      <ProjectAssociateDialogBody item={item} inputRef={inputRef} query={query} filtered={filtered} hasCurrentProject={hasCurrentProject} onSelect={select} />
    </dialog>
  );
}

/**
 * Renders an isolated modal dialog to associate an item with an active project.
 *
 * @example <ProjectAssociateDialog item={item} onClose={close} onAssociate={save} />
 */
export function ProjectAssociateDialog(props: ProjectAssociateDialogProps) {
  if (props.isOpen === false || !props.item) return null;
  return <ProjectAssociateDialogModal item={props.item} onClose={props.onClose} onAssociate={props.onAssociate} />;
}
