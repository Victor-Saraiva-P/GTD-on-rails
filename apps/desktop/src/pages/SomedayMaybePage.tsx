import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView.tsx";
import { ListWorkspace } from "../components/ListWorkspace.tsx";
import { RetryState } from "../components/RetryState.tsx";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds.ts";
import { InboxList } from "../features/inbox/InboxList.tsx";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails.tsx";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch.ts";
import { LeaderMenu } from "../features/keybinds/LeaderMenu.tsx";
import { useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks.ts";
import type { FocusZoneId, KeybindDefinition } from "../features/keybinds/types.ts";
import { deletedSomedayMaybeListTheme, somedayMaybeListTheme } from "../features/lists/listThemes.ts";
import { openOwnerProject as triggerOpenOwnerProject } from "../features/projects/ownerProjectNavigation.ts";
import { ProjectAssociateDialog } from "../features/projects/ProjectAssociateDialog.tsx";
import type { Project } from "../features/projects/types.ts";
import { useProjectAssociateDialog } from "../features/projects/useProjectAssociateDialog.ts";
import type { SomedayMaybeWorkspaceController } from "../features/someday-maybe/useSomedayMaybeWorkspaceController.ts";

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog.tsx");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog.tsx");
  return { default: module.MarkdownLinkComboDialog };
});

type SomedayMaybePageProps = Readonly<{
  controller: SomedayMaybeWorkspaceController;
  openOwnerProject?: (projectId: string, projectTitle?: string | null) => void;
  projects?: Project[];
}>;

function canEditSelected(controller: SomedayMaybeWorkspaceController): boolean {
  return !controller.isLoading && !controller.isUpdating && Boolean(controller.selectedItem);
}

function somedayMaybeBinding(
  id: string,
  key: string,
  description: string,
  zone: FocusZoneId,
  runKeybind: () => void,
  leader = false,
  sequence?: string[]
): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "someday-maybe", sequence, zone };
}

function moveSelection(controller: SomedayMaybeWorkspaceController, direction: "next" | "previous") {
  if (!controller.editingId && !controller.editingBodyId) {
    direction === "next" ? controller.selectNext() : controller.selectPrevious();
  }
}

function selectBoundary(controller: SomedayMaybeWorkspaceController, boundary: "first" | "last") {
  if (controller.editingId || controller.editingBodyId) return;
  boundary === "first" ? controller.selectFirst() : controller.selectLast();
}

function buildNavigationBindings(controller: SomedayMaybeWorkspaceController): KeybindDefinition[] {
  return [
    somedayMaybeBinding("someday-maybe.move-down", "j", "Move down", "someday-maybe-list", () => moveSelection(controller, "next")),
    somedayMaybeBinding("someday-maybe.move-up", "k", "Move up", "someday-maybe-list", () => moveSelection(controller, "previous")),
    somedayMaybeBinding("someday-maybe.move-first", "g", "Move to first item", "someday-maybe-list", () => selectBoundary(controller, "first"), false, ["g", "g"]),
    somedayMaybeBinding("someday-maybe.move-last", "G", "Move to last item", "someday-maybe-list", () => selectBoundary(controller, "last")),
    somedayMaybeBinding("someday-maybe.focus-detail", "l", "Focus detail", "someday-maybe-list", () => controller.setActiveZone("someday-maybe-detail")),
    somedayMaybeBinding("someday-maybe.focus-list", "h", "Focus list", "someday-maybe-detail", () => controller.setActiveZone("someday-maybe-list")),
    somedayMaybeBinding("someday-maybe.switch-next", "]", "Next subview", "someday-maybe-list", () => controller.switchSubview("next")),
    somedayMaybeBinding("someday-maybe.switch-prev", "[", "Previous subview", "someday-maybe-list", () => controller.switchSubview("previous"))
  ];
}

function buildActionBindings(
  controller: SomedayMaybeWorkspaceController,
  openProjectAssociate: () => void,
  openOwnerProject?: (projectId: string, projectTitle?: string | null) => void,
  projects: Project[] = []
): KeybindDefinition[] {
  return [
    somedayMaybeBinding("someday-maybe.edit-title", "Enter", "Edit title", "someday-maybe-list", controller.startEditingTitle),
    somedayMaybeBinding("someday-maybe.edit-body", "l", "Edit body", "someday-maybe-list", controller.startEditingBody),
    somedayMaybeBinding("someday-maybe.revert", "i", "Move to inbox", "someday-maybe-list", () => void controller.revertSelectedToStuff()),
    somedayMaybeBinding("someday-maybe.delete", "d", "Delete item", "someday-maybe-list", () => void controller.deleteSelected()),
    somedayMaybeBinding("someday-maybe.undo", "u", "Undo", "someday-maybe-list", () => void controller.undo()),
    { ...somedayMaybeBinding("someday-maybe.redo", "r", "Redo", "someday-maybe-list", () => void controller.redo()), ctrl: true },
    somedayMaybeBinding("someday-maybe.project", "P", "Associate project", "someday-maybe-list", () => {
      if (canEditSelected(controller)) openProjectAssociate();
    }),
    somedayMaybeBinding("someday-maybe.jump-project", "d", "Jump to project", "someday-maybe-list", () => {
      if (canEditSelected(controller)) triggerOpenOwnerProject(controller.selectedItem, openOwnerProject, projects);
    }, false, ["g", "d"]),
    somedayMaybeBinding("someday-maybe.which-key", "k", "Show available keybinds", "someday-maybe-list", () => undefined, true)
  ];
}

function buildDeletedBindings(controller: SomedayMaybeWorkspaceController): KeybindDefinition[] {
  if (controller.activeSubview !== "deleted") return [];
  return [
    somedayMaybeBinding("someday-maybe.recover", "r", "Recover item", "someday-maybe-list", () => void controller.recoverSelected()),
    somedayMaybeBinding("someday-maybe.recover-detail", "r", "Recover item", "someday-maybe-detail", () => void controller.recoverSelected())
  ];
}

function useSomedayMaybeBindings(
  controller: SomedayMaybeWorkspaceController,
  openLinkCombo: () => void,
  openAssetCombo: () => void,
  openProjectAssociate: () => void,
  openOwnerProject?: (projectId: string, projectTitle?: string | null) => void,
  projects: Project[] = []
) {
  const bindings = useMemo(() => [
    ...buildNavigationBindings(controller),
    ...buildActionBindings(controller, openProjectAssociate, openOwnerProject, projects),
    ...buildDeletedBindings(controller),
    ...buildFormattingBindings("someday-maybe", openLinkCombo, openAssetCombo, "someday-maybe-detail")
  ], [controller, openLinkCombo, openAssetCombo, openProjectAssociate, openOwnerProject, projects]);

  useRegisterKeybinds(bindings);
}

function useSomedayMaybeZone(controller: SomedayMaybeWorkspaceController) {
  useEffect(() => {
    if (controller.activeZone !== "someday-maybe-list" && controller.activeZone !== "someday-maybe-detail") {
      controller.setActiveZone("someday-maybe-list");
    }
  }, [controller.activeZone, controller.setActiveZone]);
}

function SomedayMaybeListBody({ controller }: Readonly<{ controller: SomedayMaybeWorkspaceController }>) {
  if (controller.isLoading) return <p className="pane-state">Loading someday/maybe...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.stuffs.length === 0) {
    const empty = controller.activeSubview === "active" ? "No someday/maybe items." : "No deleted someday/maybe items.";
    return <p className="pane-state">{empty}</p>;
  }
  return (
    <InboxList
      items={controller.stuffs}
      selectedId={controller.selectedItem?.id ?? ""}
      editingId={controller.editingId}
      editingTitle={controller.editingTitle}
      editingTitleError={controller.editingTitleError}
      onSelect={(id) => controller.setSelectedId(id)}
      onEditingTitleChange={controller.setEditingTitle}
      onStartEditing={controller.startEditingTitle}
      onCommitEditing={() => void controller.commitEditingTitle()}
      onCommitEditingAndContinue={() => void controller.commitEditingTitle()}
      onCancelEditing={controller.cancelEditingTitle}
      glyph="S"
    />
  );
}

function SomedayMaybeDetailBody({ controller }: Readonly<{ controller: SomedayMaybeWorkspaceController }>) {
  if (!controller.selectedItem) return <p className="pane-state">No someday/maybe selected.</p>;
  return (
    <InboxStuffDetails
      item={controller.selectedItem}
      editing={controller.editingBodyId === controller.selectedItem.id}
      onAutosaveEditing={controller.autosaveEditingBody}
      onCommitEditing={controller.commitEditingBody}
      onExitEditingFromNormalMode={controller.commitEditingBody}
      onCancelEditing={controller.cancelEditingBody}
      onVimModeChange={controller.setVimMode}
    />
  );
}

/**
 * Renders the Someday/Maybe workspace with list, detail view, and keyboard navigation.
 *
 * @example <SomedayMaybePage controller={controller} />
 */
export function SomedayMaybePage({ controller, openOwnerProject, projects = [] }: SomedayMaybePageProps) {
  const [isLinkComboOpen, setIsLinkComboOpen] = useState(false);
  const [isAssetComboOpen, setIsAssetComboOpen] = useState(false);
  const projectAssociate = useProjectAssociateDialog();
  const theme = controller.activeSubview === "active" ? somedayMaybeListTheme : deletedSomedayMaybeListTheme;
  const listTitle = controller.activeSubview === "active" ? "Someday/Maybe" : "Deleted Someday/Maybe";

  useKeybindScreen("someday-maybe");
  useSomedayMaybeZone(controller);
  useSomedayMaybeBindings(
    controller,
    () => setIsLinkComboOpen(true),
    () => setIsAssetComboOpen(true),
    projectAssociate.open,
    openOwnerProject,
    projects
  );

  return (
    <ListWorkspace theme={theme} currentLabel={theme.label} modeLabel={controller.vimMode ?? undefined}>
      <section className="inbox-terminal-layout" aria-label="Someday/Maybe">
        <ListView title={listTitle} viewIndex={1} active={controller.activeZone === "someday-maybe-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
          <SomedayMaybeListBody controller={controller} />
        </ListView>
        <ListView title="Someday/Maybe Detail" viewIndex={2} active={controller.activeZone === "someday-maybe-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
          <SomedayMaybeDetailBody controller={controller} />
        </ListView>
      </section>
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkComboOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkComboOpen(false)} /> : null}
        {isAssetComboOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetComboOpen(false)} /> : null}
      </Suspense>
      <ProjectAssociateDialog item={controller.selectedItem} isOpen={projectAssociate.isOpen} onClose={projectAssociate.close} onAssociate={controller.assignSelectedProject} />
    </ListWorkspace>
  );
}
