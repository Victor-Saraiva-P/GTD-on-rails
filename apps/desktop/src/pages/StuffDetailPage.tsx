import { useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { formatStuffBodyVimMode, type StuffBodyVimMode } from "../features/inbox/stuffBodyVim";
import type { InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { stuffDetailListTheme } from "../features/lists/listThemes";

type StuffDetailPageProps = {
  controller: InboxWorkspaceController;
  onEditorModeChange?: (mode: StuffBodyVimMode | null) => void;
};

function stuffDetailBinding(id: string, key: string, description: string, runKeybind: () => void, leader = false): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "stuff-detail", zone: "stuff-detail" };
}

function canEditStuffBody(controller: InboxWorkspaceController): boolean {
  return !controller.isLoading && !controller.isCreating && !controller.isDeleting && !controller.isUpdating && !controller.editingBodyId && Boolean(controller.selectedItem);
}

function editStuffBodyFromKeybind(controller: InboxWorkspaceController) {
  if (canEditStuffBody(controller)) {
    controller.startEditingSelectedStuffBody();
  }
}

function backToInboxFromKeybind(controller: InboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (!controller.editingBodyId) {
    controller.setActiveZone("inbox-list");
    setActiveScreen("inbox");
  }
}

function buildStuffDetailBindings(controller: InboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  return [
    stuffDetailBinding("stuff-detail-page.edit-body", "Enter", "Edit selected body", () => editStuffBodyFromKeybind(controller)),
    stuffDetailBinding("stuff-detail-page.back-to-inbox", "Escape", "Back to inbox", () => backToInboxFromKeybind(controller, setActiveScreen)),
    stuffDetailBinding("stuff-detail-page.which-key", "k", "Show available keybinds", () => undefined, true)
  ];
}

function useStuffDetailBindings(controller: InboxWorkspaceController) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildStuffDetailBindings(controller, setActiveScreen), [controller, setActiveScreen]);

  useRegisterKeybinds(bindings);
}

function useStuffDetailZone(controller: InboxWorkspaceController) {
  useEffect(() => {
    controller.setActiveZone("stuff-detail");
  }, [controller]);
}

function commitStuffBody(controller: InboxWorkspaceController) {
  void controller.commitEditingSelectedStuffBody().catch((error: unknown) => {
    console.error("Failed to update stuff body", error);
  });
}

function StuffDetailReady({ controller, onEditorModeChange }: StuffDetailPageProps) {
  const selectedItem = controller.selectedItem;

  return selectedItem ? (
    <InboxStuffDetails
      item={selectedItem}
      editing={controller.editingBodyId === selectedItem.id}
      editingBody={controller.editingBody}
      onEditingBodyChange={controller.setEditingBody}
      onCommitEditing={() => commitStuffBody(controller)}
      onCancelEditing={() => commitStuffBody(controller)}
      onModeChange={onEditorModeChange}
    />
  ) : null;
}

function StuffDetailBody({ controller, onEditorModeChange }: StuffDetailPageProps) {
  if (controller.isLoading) {
    return <p className="pane-state">Loading stuff details...</p>;
  }

  if (controller.errorMessage) {
    return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  }

  return controller.selectedItem ? (
    <StuffDetailReady controller={controller} onEditorModeChange={onEditorModeChange} />
  ) : (
    <p className="pane-state">Select a stuff in inbox to inspect its details.</p>
  );
}

function StuffDetailPane({ controller, onEditorModeChange }: StuffDetailPageProps) {
  return (
    <ListPane title="Stuff Detail" active bodyClassName="list-pane__body--detail">
      <StuffDetailBody controller={controller} onEditorModeChange={onEditorModeChange} />
    </ListPane>
  );
}

/**
 * Renders the focused stuff-detail screen and its detail keybindings.
 *
 * @example <StuffDetailPage controller={controller} />
 */
export function StuffDetailPage({ controller }: StuffDetailPageProps) {
  const [editorMode, setEditorMode] = useState<StuffBodyVimMode | null>(null);
  useKeybindScreen("stuff-detail");
  useStuffDetailZone(controller);
  useStuffDetailBindings(controller);

  return (
    <ListWorkspace theme={stuffDetailListTheme} currentLabel={stuffDetailListTheme.label} modeLabel={formatStuffBodyVimMode(editorMode)}>
      <section className="stuff-detail-layout" aria-label="Stuff detail">
        <StuffDetailPane controller={controller} onEditorModeChange={setEditorMode} />
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}
