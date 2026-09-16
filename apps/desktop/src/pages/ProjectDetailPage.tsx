import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import type { CalendarConversionPayload } from "../features/calendar/types";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";
import { projectsListTheme } from "../features/lists/listThemes";
import { ProcessingDialog } from "../features/processing/ProcessingDialog";
import { ProjectActionsList } from "../features/projects/ProjectActionsList";
import { ProjectAssociateDialog } from "../features/projects/ProjectAssociateDialog";
import { useProjectAssociateDialog } from "../features/projects/useProjectAssociateDialog";
import { formatProjectActionCount } from "../features/projects/types";
import type { Project } from "../features/projects/types";
import type { ProjectItem } from "../features/projects/projectItems";
import type { ProjectDetailController } from "../features/projects/useProjectDetailController";
import { useListTitleSearch } from "../features/title-search/useListTitleSearch";

type ProjectDetailPageProps = Readonly<{
  controller: ProjectDetailController;
  openItemDestination?: (item: ProjectItem) => void;
  openOwnerProject?: (projectId: string, projectTitle?: string | null) => void;
  projects?: Project[];
}>;

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog");
  return { default: module.MarkdownLinkComboDialog };
});

function projectDetailBinding(id: string, key: string, description: string, zone: "project-actions-list" | "project-item-detail", runKeybind: () => void, leader = false, sequence?: string[]): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "project-detail", sequence, zone };
}

function canRunAction(controller: ProjectDetailController): boolean {
  return !controller.isLoading && !controller.isDeleting && Boolean(controller.project);
}

function canEditProjectItem(controller: ProjectDetailController): boolean {
  return canRunAction(controller) && Boolean(controller.selectedItem) && !controller.editingId && !controller.editingBodyId;
}

function canUndoProjectAction(controller: ProjectDetailController): boolean {
  return canRunAction(controller) && !controller.editingId && !controller.editingBodyId;
}

function openItemDestinationFromKeybind(
  controller: ProjectDetailController,
  openItemDestination?: (item: ProjectItem) => void
) {
  if (!openItemDestination || !canEditProjectItem(controller)) return;
  const item = controller.selectedItem;
  if (!item || item.id === "__draft_project_item__") return;
  openItemDestination(item);
}

function buildListNavigationBindings(controller: ProjectDetailController): KeybindDefinition[] {
  return [
    projectDetailBinding("project-detail.create-stuff", "a", "Add project stuff", "project-actions-list", () => canRunAction(controller) && controller.createNewStuff()),
    projectDetailBinding("project-detail.edit-title", "Enter", "Edit selected title", "project-actions-list", () => canRunAction(controller) && controller.startTitleEdit()),
    projectDetailBinding("project-detail.move-down", "j", "Move down", "project-actions-list", controller.selectNext),
    projectDetailBinding("project-detail.move-up", "k", "Move up", "project-actions-list", controller.selectPrevious),
    projectDetailBinding("project-detail.move-first", "g", "Move to first item", "project-actions-list", controller.selectFirst, false, ["g", "g"]),
    projectDetailBinding("project-detail.move-last", "G", "Move to last item", "project-actions-list", controller.selectLast),
    projectDetailBinding("project-detail.open-detail", "l", "Open selected detail", "project-actions-list", () => canRunAction(controller) && controller.startBodyEdit()),
    projectDetailBinding("project-detail.which-key-list", "k", "Show available keybinds", "project-actions-list", () => undefined, true)
  ];
}

function buildItemActionBindings(
  controller: ProjectDetailController,
  openProcessing: () => void,
  openAssociate: () => void,
  openItemDestination?: (item: ProjectItem) => void
): KeybindDefinition[] {
  return [
    projectDetailBinding("project-detail.process", "p", "Process selected stuff", "project-actions-list", () => openProjectProcessing(controller, openProcessing)),
    projectDetailBinding("project-detail.associate-list", "P", "Associate to project", "project-actions-list", () => canEditProjectItem(controller) && openAssociate()),
    projectDetailBinding("project-detail.associate-detail", "P", "Associate to project", "project-item-detail", () => canEditProjectItem(controller) && openAssociate()),
    projectDetailBinding("project-detail.open-destination-list", "d", "Open item destination", "project-actions-list", () => openItemDestinationFromKeybind(controller, openItemDestination), false, ["g", "d"]),
    projectDetailBinding("project-detail.open-destination-detail", "d", "Open item destination", "project-item-detail", () => openItemDestinationFromKeybind(controller, openItemDestination), false, ["g", "d"]),
    projectDetailBinding("project-detail.delete-list", "d", "Delete selected item", "project-actions-list", () => canEditProjectItem(controller) && void controller.deleteSelected()),
    projectDetailBinding("project-detail.delete-detail", "d", "Delete selected item", "project-item-detail", () => canEditProjectItem(controller) && void controller.deleteSelected()),
    projectDetailBinding("project-detail.undo-list", "u", "Undo last deletion", "project-actions-list", () => canUndoProjectAction(controller) && void controller.undo()),
    projectDetailBinding("project-detail.undo-detail", "u", "Undo last deletion", "project-item-detail", () => canUndoProjectAction(controller) && void controller.undo()),
    { ...projectDetailBinding("project-detail.redo-list", "r", "Redo last action", "project-actions-list", () => canUndoProjectAction(controller) && void controller.redo()), ctrl: true },
    { ...projectDetailBinding("project-detail.redo-detail", "r", "Redo last action", "project-item-detail", () => canUndoProjectAction(controller) && void controller.redo()), ctrl: true },
    projectDetailBinding("project-detail.which-key-detail", "k", "Show available keybinds", "project-item-detail", () => undefined, true)
  ];
}

function buildBindings(
  controller: ProjectDetailController,
  openProcessing: () => void,
  openLink: () => void,
  openAsset: () => void,
  openAssociate: () => void,
  openItemDestination?: (item: ProjectItem) => void
): KeybindDefinition[] {
  return [
    ...buildListNavigationBindings(controller),
    ...buildItemActionBindings(controller, openProcessing, openAssociate, openItemDestination),
    ...buildFormattingBindings("project-detail", openLink, openAsset, "project-item-detail")
  ];
}

function openProjectProcessing(controller: ProjectDetailController, openProcessing: () => void) {
  if (controller.selectedItem?.kind === "STUFF") openProcessing();
}

function useProjectDetailBindings(
  controller: ProjectDetailController,
  openProcessing: () => void,
  openLink: () => void,
  openAsset: () => void,
  openAssociate: () => void,
  openItemDestination?: (item: ProjectItem) => void
) {
  const bindings = useMemo(
    () => buildBindings(controller, openProcessing, openLink, openAsset, openAssociate, openItemDestination),
    [controller, openProcessing, openLink, openAsset, openAssociate, openItemDestination]
  );
  useRegisterKeybinds(bindings);
}

function metaVariant(item: ProjectItem): "default" | "next-action" | "calendar" {
  if (item.kind === "CALENDAR") return "calendar";
  if (item.kind === "NEXT_ACTION") return "next-action";
  return "default";
}

function ProjectActionBody({ controller }: ProjectDetailPageProps) {
  if (controller.isLoading) return <p className="pane-state">Loading project actions...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.items.length === 0) return <p className="pane-state">No project actions.</p>;
  return <ProjectActionsList items={controller.items} selectedId={controller.selectedItem?.id ?? ""} editingId={controller.editingId} editingTitle={controller.editingTitle} editingTitleError={controller.editingTitleError} onSelect={controller.setSelectedId} onEditingTitleChange={controller.setEditingTitle} onStartEditing={controller.startTitleEdit} onCommitEditing={() => void controller.commitTitle()} onCommitEditingAndContinue={() => void controller.commitTitle()} onCancelEditing={controller.cancelTitleEdit} />;
}

function ProjectItemDetailBody({ controller }: ProjectDetailPageProps) {
  const item = controller.selectedItem;
  if (!item) return <p className="pane-state">Select a project item to inspect its details.</p>;
  return <InboxStuffDetails item={item} showCreatedMeta={item.kind === "STUFF" || item.kind === "SOMEDAY_MAYBE"} metaVariant={metaVariant(item)} editing={controller.editingBodyId === item.id} onAutosaveEditing={controller.autosaveBody} onCommitEditing={controller.commitBody} onExitEditingFromNormalMode={(body) => exitProjectItemDetail(controller, body)} onCancelEditing={controller.cancelBodyEdit} onVimModeChange={controller.setVimMode} />;
}

async function exitProjectItemDetail(controller: ProjectDetailController, body: ItemBody): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone("project-actions-list");
}

function ProjectDetailView({ controller }: ProjectDetailPageProps) {
  const actionCount = controller.items.filter((item) => item.kind === "NEXT_ACTION" || item.kind === "CALENDAR").length;
  return (
    <>
      <ListView title={controller.project?.title ?? "Project"} meta={formatProjectActionCount(actionCount)} viewIndex={1} active={controller.activeZone === "project-actions-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
        <ProjectActionBody controller={controller} />
      </ListView>
      <ListView title="Item Detail" viewIndex={2} active={controller.activeZone === "project-item-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
        <ProjectItemDetailBody controller={controller} />
      </ListView>
    </>
  );
}

function useProjectDetailZone(controller: ProjectDetailController) {
  useEffect(() => {
    if (controller.activeZone !== "project-actions-list" && controller.activeZone !== "project-item-detail") {
      controller.setActiveZone("project-actions-list");
    }
  }, [controller.activeZone, controller.setActiveZone]);
}

type ProjectDetailModalsProps = Readonly<{
  controller: ProjectDetailController;
  isProcessingOpen: boolean;
  setIsProcessingOpen: (open: boolean) => void;
  isLinkOpen: boolean;
  setIsLinkOpen: (open: boolean) => void;
  isAssetOpen: boolean;
  setIsAssetOpen: (open: boolean) => void;
  projectAssociate: ReturnType<typeof useProjectAssociateDialog>;
}>;

function ProjectDetailComboModals(props: ProjectDetailModalsProps) {
  const item = props.controller.selectedItem;
  return (
    <Suspense fallback={null}>
      {props.isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => props.setIsLinkOpen(false)} /> : null}
      {props.isAssetOpen && item ? <LazyMarkdownAssetComboDialog itemId={item.id} onClose={() => props.setIsAssetOpen(false)} /> : null}
      <ProjectAssociateDialog
        item={item}
        isOpen={props.projectAssociate.isOpen}
        onClose={props.projectAssociate.close}
        onAssociate={props.controller.assignSelectedProject}
      />
    </Suspense>
  );
}

function ProjectDetailModals(props: ProjectDetailModalsProps) {
  const item = props.controller.selectedItem;
  return (
    <>
      <ProjectDetailComboModals {...props} />
      {props.isProcessingOpen && item ? (
        <ProcessingDialog
          allowProject={false}
          item={item}
          onClose={() => props.setIsProcessingOpen(false)}
          onProcess={(energy, minutes, contextIds, deadline) => { void props.controller.processSelectedStuff(energy, minutes, contextIds, deadline); props.setIsProcessingOpen(false); }}
          onProcessCalendar={(payload: CalendarConversionPayload) => { void props.controller.processSelectedStuffToCalendar(payload); props.setIsProcessingOpen(false); }}
          onProcessProject={() => undefined}
          onProcessSomedayMaybe={() => { void props.controller.processSelectedStuffToSomedayMaybe(); props.setIsProcessingOpen(false); }}
        />
      ) : null}
    </>
  );
}

export function ProjectDetailPage({ controller, openItemDestination }: ProjectDetailPageProps) {
  const [isProcessingOpen, setIsProcessingOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const projectAssociate = useProjectAssociateDialog();
  useKeybindScreen("project-detail");
  useProjectDetailZone(controller);
  useProjectDetailBindings(controller, () => setIsProcessingOpen(true), () => setIsLinkOpen(true), () => setIsAssetOpen(true), projectAssociate.open, openItemDestination);
  const titleSearch = useListTitleSearch({
    disabled: Boolean(controller.editingId || controller.editingBodyId),
    items: controller.items,
    screen: "project-detail",
    selectedId: controller.selectedItem?.id ?? null,
    setSelectedId: controller.setSelectedId,
    zone: "project-actions-list"
  });

  return (
    <ListWorkspace theme={projectsListTheme} currentLabel={projectsListTheme.label} modeLabel={controller.vimMode ?? undefined} titleSearch={titleSearch}>
      <section className="inbox-terminal-layout" aria-label="Project detail">
        <ProjectDetailView controller={controller} />
      </section>
      <LeaderMenu />
      <ProjectDetailModals
        controller={controller}
        isProcessingOpen={isProcessingOpen}
        setIsProcessingOpen={setIsProcessingOpen}
        isLinkOpen={isLinkOpen}
        setIsLinkOpen={setIsLinkOpen}
        isAssetOpen={isAssetOpen}
        setIsAssetOpen={setIsAssetOpen}
        projectAssociate={projectAssociate}
      />
    </ListWorkspace>
  );
}
