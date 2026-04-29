import { useEffect, useMemo } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import type { InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { stuffDetailListTheme } from "../features/lists/listThemes";

type StuffDetailPageProps = {
  controller: InboxWorkspaceController;
};

function stuffDetailBinding(id: string, key: string, description: string, handler: () => void, leader = false): KeybindDefinition {
  return { description, handler, id, key, leader, screen: "stuff-detail", zone: "stuff-detail" };
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

function RetryState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="pane-state">
      <p>{message}</p>
      <button type="button" className="pane-state__action" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function StuffDetailReady({ controller }: StuffDetailPageProps) {
  const selectedItem = controller.selectedItem;

  return selectedItem ? (
    <InboxStuffDetails
      item={selectedItem}
      editing={controller.editingBodyId === selectedItem.id}
      editingBody={controller.editingBody}
      onEditingBodyChange={controller.setEditingBody}
      onCommitEditing={() => commitStuffBody(controller)}
      onCancelEditing={() => commitStuffBody(controller)}
    />
  ) : null;
}

function StuffDetailBody({ controller }: StuffDetailPageProps) {
  if (controller.isLoading) {
    return <p className="pane-state">Loading stuff details...</p>;
  }

  if (controller.errorMessage) {
    return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  }

  return controller.selectedItem ? <StuffDetailReady controller={controller} /> : <p className="pane-state">Select a stuff in inbox to inspect its details.</p>;
}

function StuffDetailPane({ controller }: StuffDetailPageProps) {
  return (
    <ListPane title="Stuff Detail" active bodyClassName="list-pane__body--detail">
      <StuffDetailBody controller={controller} />
    </ListPane>
  );
}

export function StuffDetailPage({ controller }: StuffDetailPageProps) {
  useKeybindScreen("stuff-detail");
  useStuffDetailZone(controller);
  useStuffDetailBindings(controller);

  return (
    <ListWorkspace theme={stuffDetailListTheme} currentLabel={stuffDetailListTheme.label}>
      <section className="stuff-detail-layout" aria-label="Stuff detail">
        <StuffDetailPane controller={controller} />
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}
