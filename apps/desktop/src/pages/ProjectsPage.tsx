import { useCallback, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { projectsListTheme } from "../features/lists/listThemes";
import { ProjectEditDialog } from "../features/projects/ProjectEditDialog";
import { nextProjectGridSelection } from "../features/projects/projectGridNavigation";
import type { ProjectGridDirection, ProjectGridCardRect } from "../features/projects/projectGridNavigation";
import { ProjectsList } from "../features/projects/ProjectsList";
import type { ProjectPatch } from "../features/projects/types";
import type { ProjectsWorkspaceController } from "../features/projects/useProjectsWorkspaceController";

type ProjectsPageProps = Readonly<{
  controller: ProjectsWorkspaceController;
}>;

function projectBinding(id: string, key: string, description: string, runKeybind: () => void): KeybindDefinition {
  return { id, key, description, runKeybind, screen: "projects", zone: "projects-list" };
}

function canEdit(controller: ProjectsWorkspaceController): boolean {
  return !controller.isLoading && !controller.isUpdating && Boolean(controller.selectedItem);
}

function buildProjectBindings(controller: ProjectsWorkspaceController, openEdit: () => void) {
  return [
    projectBinding("projects.move-left", "h", "Move to project on the left", () => moveProjectSelection(controller, "left")),
    projectBinding("projects.move-down", "j", "Move to project below", () => moveProjectSelection(controller, "down")),
    projectBinding("projects.move-up", "k", "Move to project above", () => moveProjectSelection(controller, "up")),
    projectBinding("projects.move-right", "l", "Move to project on the right", () => moveProjectSelection(controller, "right")),
    projectBinding("projects.edit", "e", "Edit selected project", () => canEdit(controller) && openEdit()),
    { ...projectBinding("projects.which-key", "k", "Show available keybinds", () => undefined), leader: true }
  ];
}

function moveProjectSelection(controller: ProjectsWorkspaceController, direction: ProjectGridDirection) {
  const selectedId = controller.selectedItem?.id;
  if (!selectedId) return;
  controller.setSelectedId(nextProjectGridSelection(projectCardRects(), selectedId, direction));
}

function projectCardRects(): ProjectGridCardRect[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".project-card[data-project-id]")).map((element) => {
    const rect = element.getBoundingClientRect();
    return { id: element.dataset.projectId ?? "", left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }).filter((rect) => rect.id);
}

function ProjectsBody({ controller }: ProjectsPageProps) {
  if (controller.isLoading) return <p className="pane-state">Loading projects...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.projects.length === 0) return <p className="pane-state">No projects yet.</p>;
  return <ProjectsList items={controller.projects} selectedId={controller.selectedItem?.id ?? ""} onSelect={controller.setSelectedId} />;
}

/**
 * Renders project cards and project editing keybindings.
 *
 * @example <ProjectsPage controller={controller} />
 */
export function ProjectsPage({ controller }: ProjectsPageProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const openEdit = useCallback(() => setIsEditOpen(true), []);
  const bindings = useMemo(() => buildProjectBindings(controller, openEdit), [controller, openEdit]);
  useKeybindScreen("projects");
  useRegisterKeybinds(bindings);
  return (
    <ListWorkspace theme={projectsListTheme} currentLabel={projectsListTheme.label}>
      <section className="projects-terminal-layout" aria-label="Projects">
        <ListView title="Projects" viewIndex={1} active={controller.activeZone === "projects-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list projects-pane">
          <ProjectsBody controller={controller} />
        </ListView>
      </section>
      <LeaderMenu />
      {isEditOpen && controller.selectedItem ? <ProjectEditDialog item={controller.selectedItem} onSave={(patch) => saveProject(controller, patch, () => setIsEditOpen(false))} onClose={() => setIsEditOpen(false)} /> : null}
    </ListWorkspace>
  );
}

async function saveProject(controller: ProjectsWorkspaceController, patch: ProjectPatch, close: () => void) {
  await controller.patchSelected(patch);
  close();
}
