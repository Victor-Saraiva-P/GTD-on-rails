import { useEffect, useMemo } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../features/keybinds/types";
import type { ListTheme } from "../features/lists/listThemes";
import { NextActionsList } from "../features/next-actions/NextActionsList";
import type { ArchivedNextActionsWorkspaceController } from "../features/next-actions/useArchivedNextActionsWorkspaceController";

type ArchivedNextActionsPageProps = {
  controller: ArchivedNextActionsWorkspaceController;
  detailTitle: string;
  emptyMessage: string;
  label: string;
  listTitle: string;
  screen: ScreenId;
  listZone: FocusZoneId;
  detailZone: FocusZoneId;
  previousScreen: ScreenId;
  nextScreen: ScreenId;
  theme: ListTheme;
};

function archivedBinding(
  props: ArchivedNextActionsPageProps,
  id: string,
  key: string,
  description: string,
  zone: FocusZoneId,
  runKeybind: () => void,
  leader = false
): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: props.screen, zone };
}

function canRecover(controller: ArchivedNextActionsWorkspaceController): boolean {
  return !controller.isLoading && !controller.isUpdating && Boolean(controller.selectedItem);
}

function canDelete(props: ArchivedNextActionsPageProps): boolean {
  return props.controller.canDelete && Boolean(props.controller.selectedItem) && !props.controller.isLoading && !props.controller.isUpdating;
}

function recoverSelected(controller: ArchivedNextActionsWorkspaceController) {
  if (canRecover(controller)) {
    void controller.recoverSelected().catch((error: unknown) => console.error("Failed to recover next action", error));
  }
}

function deleteSelected(props: ArchivedNextActionsPageProps) {
  if (canDelete(props)) {
    void props.controller.deleteSelected().catch((error: unknown) => console.error("Failed to delete next action", error));
  }
}

function moveSelection(controller: ArchivedNextActionsWorkspaceController, direction: "next" | "previous") {
  direction === "next" ? controller.selectNext() : controller.selectPrevious();
}

function switchScreen(props: ArchivedNextActionsPageProps, screen: ScreenId, setActiveScreen: (screen: ScreenId) => void) {
  props.controller.resetWorkspace();
  setActiveScreen(screen);
}

function buildListBindings(props: ArchivedNextActionsPageProps, setActiveScreen: (screen: ScreenId) => void) {
  const bindings = [
    archivedBinding(props, `${props.screen}.recover-list`, "r", "Recover selected next action", props.listZone, () => recoverSelected(props.controller)),
    archivedBinding(props, `${props.screen}.move-down`, "j", "Move down", props.listZone, () => moveSelection(props.controller, "next")),
    archivedBinding(props, `${props.screen}.move-up`, "k", "Move up", props.listZone, () => moveSelection(props.controller, "previous")),
    archivedBinding(props, `${props.screen}.focus-detail`, "l", "Focus next action detail", props.listZone, () => props.controller.setActiveZone(props.detailZone)),
    archivedBinding(props, `${props.screen}.switch-forward`, "]", `Open ${props.nextScreen}`, props.listZone, () => switchScreen(props, props.nextScreen, setActiveScreen)),
    archivedBinding(props, `${props.screen}.switch-back`, "[", `Open ${props.previousScreen}`, props.listZone, () => switchScreen(props, props.previousScreen, setActiveScreen)),
    archivedBinding(props, `${props.screen}.which-key-list`, "k", "Show available keybinds", props.listZone, () => undefined, true)
  ];

  return props.controller.canDelete ? [archivedBinding(props, `${props.screen}.delete-list`, "d", "Delete selected next action", props.listZone, () => deleteSelected(props)), ...bindings] : bindings;
}

function buildDetailBindings(props: ArchivedNextActionsPageProps, setActiveScreen: (screen: ScreenId) => void) {
  const bindings = [
    archivedBinding(props, `${props.screen}.recover-detail`, "r", "Recover selected next action", props.detailZone, () => recoverSelected(props.controller)),
    archivedBinding(props, `${props.screen}.focus-list`, "h", "Focus next actions list", props.detailZone, () => props.controller.setActiveZone(props.listZone)),
    archivedBinding(props, `${props.screen}.switch-forward-detail`, "]", `Open ${props.nextScreen}`, props.detailZone, () => switchScreen(props, props.nextScreen, setActiveScreen)),
    archivedBinding(props, `${props.screen}.switch-back-detail`, "[", `Open ${props.previousScreen}`, props.detailZone, () => switchScreen(props, props.previousScreen, setActiveScreen)),
    archivedBinding(props, `${props.screen}.which-key-detail`, "k", "Show available keybinds", props.detailZone, () => undefined, true)
  ];

  return props.controller.canDelete ? [archivedBinding(props, `${props.screen}.delete-detail`, "d", "Delete selected next action", props.detailZone, () => deleteSelected(props)), ...bindings] : bindings;
}

function useArchivedBindings(props: ArchivedNextActionsPageProps) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => [
    ...buildListBindings(props, setActiveScreen),
    ...buildDetailBindings(props, setActiveScreen)
  ], [props, setActiveScreen]);

  useRegisterKeybinds(bindings);
}

function useArchivedZone(props: ArchivedNextActionsPageProps) {
  useEffect(() => {
    if (props.controller.activeZone !== props.listZone && props.controller.activeZone !== props.detailZone) {
      props.controller.setActiveZone(props.listZone);
    }
  }, [props]);
}

function useArchivedAssetPreload(controller: ArchivedNextActionsWorkspaceController) {
  useEffect(() => {
    if (controller.selectedIndex < 0) return;
    prefetchNearbyInboxAssets(controller.stuffs, controller.selectedIndex);
  }, [controller.selectedIndex, controller.stuffs]);
}

function ArchivedListReady({ controller }: Pick<ArchivedNextActionsPageProps, "controller">) {
  return (
    <NextActionsList
      items={controller.stuffs}
      selectedId={controller.selectedItem?.id ?? ""}
      editingId={null}
      editingTitle=""
      onSelect={controller.setSelectedId}
      onEditingTitleChange={() => undefined}
      onStartEditing={() => undefined}
      onCommitEditing={() => undefined}
      onCommitEditingAndContinue={() => undefined}
      onCancelEditing={() => undefined}
    />
  );
}

function ArchivedListBody(props: ArchivedNextActionsPageProps) {
  if (props.controller.isLoading) return <p className="pane-state">Loading {props.label.toLowerCase()}...</p>;
  if (props.controller.errorMessage) return <RetryState message={props.controller.errorMessage} onRetry={props.controller.reload} />;
  if (props.controller.stuffs.length === 0) return <p className="pane-state">{props.emptyMessage}</p>;
  return <ArchivedListReady controller={props.controller} />;
}

function ArchivedDetailBody(props: ArchivedNextActionsPageProps) {
  const item = props.controller.selectedItem;
  if (props.controller.isLoading) return <p className="pane-state">Loading next action details...</p>;
  if (props.controller.errorMessage) return <p className="pane-state">Next action details are unavailable while loading fails.</p>;
  if (!item) return <p className="pane-state">Select a next action to inspect its details.</p>;

  return (
    <InboxStuffDetails
      item={item}
      showCreatedMeta={false}
      metaVariant="next-action"
      editing={false}
      onAutosaveEditing={() => Promise.resolve()}
      onCommitEditing={() => Promise.resolve()}
      onExitEditingFromNormalMode={() => Promise.resolve()}
      onCancelEditing={() => undefined}
    />
  );
}

function ArchivedListView(props: ArchivedNextActionsPageProps) {
  const count = props.controller.stuffs.length;
  const meta = `${count} ${count === 1 ? "item" : "items"}`;

  return (
    <ListView title={props.listTitle} meta={meta} viewIndex={1} active={props.controller.activeZone === props.listZone} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <ArchivedListBody {...props} />
    </ListView>
  );
}

function ArchivedDetailView(props: ArchivedNextActionsPageProps) {
  return (
    <ListView title={props.detailTitle} viewIndex={2} active={props.controller.activeZone === props.detailZone} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <ArchivedDetailBody {...props} />
    </ListView>
  );
}

/**
 * Renders archived next actions with list, details, recovery, and cycle keybindings.
 *
 * @example <ArchivedNextActionsPage controller={controller} ... />
 */
export function ArchivedNextActionsPage(props: ArchivedNextActionsPageProps) {
  useKeybindScreen(props.screen);
  useArchivedZone(props);
  useArchivedAssetPreload(props.controller);
  useArchivedBindings(props);

  return (
    <ListWorkspace theme={props.theme} currentLabel={props.label}>
      <section className="inbox-terminal-layout" aria-label={props.label}>
        <ArchivedListView {...props} />
        <ArchivedDetailView {...props} />
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}
