import { useCallback, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { deletedProjectsListTheme, doneProjectsListTheme, projectsListTheme } from "../features/lists/listThemes";
import { ProjectEditDialog } from "../features/projects/ProjectEditDialog";
import { nextProjectGridSelection } from "../features/projects/projectGridNavigation";
import type { ProjectGridDirection, ProjectGridCardRect } from "../features/projects/projectGridNavigation";
import { ProjectsList } from "../features/projects/ProjectsList";
import type { ProjectPatch } from "../features/projects/types";
import type { ProjectsWorkspaceController } from "../features/projects/useProjectsWorkspaceController";

type ProjectsPageProps = Readonly<{
  controller: ProjectsWorkspaceController;
}>;

function projectBinding(id: string, key: string, description: string, runKeybind: () => void, sequence?: string[]): KeybindDefinition {
  return { id, key, description, runKeybind, screen: "projects", sequence, zone: "projects-list" };
}

function canEdit(controller: ProjectsWorkspaceController): boolean {
  return !controller.isLoading && !controller.isUpdating && Boolean(controller.selectedItem);
}

function buildProjectBindings(controller: ProjectsWorkspaceController, openEdit: () => void) {
  const bindings = [
    projectBinding("projects.move-left", "h", "Move to project on the left", () => moveProjectSelection(controller, "left")),
    projectBinding("projects.move-down", "j", "Move to project below", () => moveProjectSelection(controller, "down")),
    projectBinding("projects.move-up", "k", "Move to project above", () => moveProjectSelection(controller, "up")),
    projectBinding("projects.move-right", "l", "Move to project on the right", () => moveProjectSelection(controller, "right")),
    projectBinding("projects.move-first", "g", "Move to first project", controller.selectFirst, ["g", "g"]),
    projectBinding("projects.move-last", "G", "Move to last project", controller.selectLast),
    projectBinding("projects.switch-forward", "]", "Open next Projects subview", () => controller.switchSubview("next")),
    projectBinding("projects.switch-back", "[", "Open previous Projects subview", () => controller.switchSubview("previous")),
    projectBinding("projects.edit", "e", "Edit selected project", () => canEdit(controller) && openEdit()),
    projectBinding("projects.undo", "u", "Undo last action", () => void controller.undo()),
    { ...projectBinding("projects.redo", "r", "Redo last action", () => void controller.redo()), ctrl: true },
    { ...projectBinding("projects.which-key", "k", "Show available keybinds", () => undefined), leader: true }
  ];
  if (controller.activeSubview === "active") return [...bindings, ...activeProjectBindings(controller)];
  if (controller.activeSubview === "completed") return [...bindings, ...completedProjectBindings(controller)];
  return [...bindings, projectBinding("projects.recover", "r", "Recover selected project", () => runProjectAction(controller, controller.recoverSelected, "Failed to recover project"))];
}

function activeProjectBindings(controller: ProjectsWorkspaceController): KeybindDefinition[] {
  return [
    projectBinding("projects.delete", "d", "Delete selected project", () => runProjectAction(controller, controller.deleteSelected, "Failed to delete project")),
    projectBinding("projects.done", "x", "Mark selected project done", () => runProjectAction(controller, controller.markSelectedDone, "Failed to mark project done"))
  ];
}

function completedProjectBindings(controller: ProjectsWorkspaceController): KeybindDefinition[] {
  return [
    projectBinding("projects.delete-completed", "d", "Delete selected project", () => runProjectAction(controller, controller.deleteSelected, "Failed to delete project")),
    projectBinding("projects.restore", "r", "Restore selected project", () => runProjectAction(controller, controller.resetSelectedStatus, "Failed to restore project"))
  ];
}

function runProjectAction(controller: ProjectsWorkspaceController, action: () => Promise<void>, message: string) {
  if (!canEdit(controller)) return;
  void action().catch((error: unknown) => console.error(message, error));
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
  if (controller.isLoading) return <p className="pane-state">Loading {projectLabel(controller).toLowerCase()}...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.projects.length === 0) return <p className="pane-state">{projectEmptyMessage(controller)}</p>;
  return <ProjectsList items={controller.projects} selectedId={controller.selectedItem?.id ?? ""} onSelect={controller.setSelectedId} />;
}

function projectEmptyMessage(controller: ProjectsWorkspaceController): string {
  if (controller.activeSubview === "active") return "No active projects.";
  if (controller.activeSubview === "completed") return "No completed projects.";
  return "No deleted projects.";
}

function projectLabel(controller: ProjectsWorkspaceController): string {
  if (controller.activeSubview === "active") return "Projects";
  if (controller.activeSubview === "completed") return "Completed Projects";
  return "Deleted Projects";
}

function projectTheme(controller: ProjectsWorkspaceController) {
  if (controller.activeSubview === "active") return projectsListTheme;
  if (controller.activeSubview === "completed") return doneProjectsListTheme;
  return deletedProjectsListTheme;
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
  const theme = projectTheme(controller);
  return (
    <ListWorkspace theme={theme} currentLabel={theme.label}>
      <section className="projects-terminal-layout" aria-label={projectLabel(controller)}>
        <ListView title={projectLabel(controller)} viewIndex={1} active={controller.activeZone === "projects-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list projects-pane">
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
